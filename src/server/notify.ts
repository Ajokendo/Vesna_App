import 'server-only';
import { and, eq, gte, inArray, lt } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { addDays, dayMonth, hhmm, utcToZoned, weekdayFull, weekdayShort, zonedToUtc } from '@/lib/time';
import { payerOf, sendToClients, signId } from './push';
import { occupiesTime } from './status';
import { sendWa, waConfigured, type WaTemplate } from './whatsapp';

// Уведомления клиенту по его записи: при записи, утром в день визита (с кнопкой «Подтвердить»), за час,
// при передаче другому мастеру и при отмене. Каждое отправляется один раз.
// Сначала push в приложение; если у клиента уведомления не включены и у салона подключён WhatsApp —
// то же сообщение уходит в WhatsApp (кроме «через час» и «оцените визит» — чтобы не надоедать и не платить лишнее).

const WA_KIND: Partial<Record<Kind, WaTemplate>> = { BOOKED: 'booked', MORNING: 'reminder', MOVED: 'moved', CANCELLED: 'cancelled' };

/** То же уведомление — в WhatsApp */
async function whatsappFor(a: NonNullable<Awaited<ReturnType<typeof loadAppointment>>>, kind: Kind) {
  const tpl = WA_KIND[kind];
  if (!tpl || !waConfigured(a.salon)) return 0;
  const payer = a.client.guardianId ? await db.query.clients.findFirst({ where: eq(s.clients.id, a.client.guardianId) }) : a.client;
  if (!payer?.phone) return 0;
  const { date, minute } = utcToZoned(a.startsAt, a.salon.timezone);
  // «31 октября (сб), 09:30» — читается правильно в любом шаблоне («на …», «изменилась: …»)
  const when = `${dayMonth(date)} (${weekdayShort(date)}), ${hhmm(minute)}`;
  const name = payer.name.split(' ')[0];
  const what = `${a.staff.name}, ${a.service.name}${a.client.guardianId ? ` (для: ${a.client.name})` : ''}`;
  const place = [a.salon.city, a.salon.address].filter(Boolean).join(', ');
  const link = `${a.salon.slug}/v/${a.id}?t=${await signId(a.id)}`;
  const params = tpl === 'booked' ? [name, a.salon.name, when, what, place]
    : tpl === 'reminder' ? [name, hhmm(minute), a.salon.name, what]
      : tpl === 'moved' ? [name, a.salon.name, when, what]
        : [name, a.salon.name, when];
  const ok = await sendWa(a.salon, { clientId: payer.id, phone: payer.phone, template: tpl, params, urlSuffix: tpl === 'cancelled' ? `${a.salon.slug}/book` : link });
  return ok ? 1 : 0;
}

type Kind = 'BOOKED' | 'MORNING' | 'HOUR' | 'MOVED' | 'CANCELLED' | 'RATE';

/** С какого часа (по времени салона) уходит утреннее напоминание */
const MORNING_FROM = 8 * 60;

async function loadAppointment(id: string) {
  return db.query.appointments.findFirst({
    where: eq(s.appointments.id, id),
    with: { salon: true, staff: true, client: true, service: true },
  });
}

async function texts(a: NonNullable<Awaited<ReturnType<typeof loadAppointment>>>, kind: Kind) {
  const { date, minute } = utcToZoned(a.startsAt, a.salon.timezone);
  const when = `${weekdayFull(date)}, ${dayMonth(date)}, ${hhmm(minute)}`;
  const who = a.client.guardianId ? `${a.client.name}: ` : '';
  const what = `${a.staff.name} · ${a.service.name}`;
  const place = [a.salon.city, a.salon.address].filter(Boolean).join(', ');
  const token = await signId(a.id);
  const url = `/${a.salon.slug}/v/${a.id}?t=${token}`;
  const base = { url, tag: `appt-${a.id}` };
  switch (kind) {
    case 'BOOKED':
      return { ...base, title: `Вы записаны в «${a.salon.name}»`, body: `${who}${when}\n${what}\n${place}` };
    case 'MORNING':
      return {
        ...base, title: `Сегодня в ${hhmm(minute)} ждём вас`, body: `${who}${what}\nНажмите «Подтвердить», если всё в силе.`,
        confirmUrl: `/api/${a.salon.slug}/visits/${a.id}/confirm?t=${token}`,
      };
    case 'HOUR':
      return { ...base, title: `Через час ждём вас — ${hhmm(minute)}`, body: `${who}${what}\n${place}` };
    case 'MOVED':
      return { ...base, title: 'Ваша запись изменилась', body: `${who}${when} вас примет ${a.staff.name} (${a.service.name}). Если неудобно — напишите нам.` };
    case 'RATE':
      return { ...base, url: `${url}&rate=1`, title: `Как вам визит к ${a.staff.name}?`, body: 'Оцените, пожалуйста, — это займёт пару секунд и поможет нам стать лучше.' };
    case 'CANCELLED':
      return { ...base, url: `/${a.salon.slug}/book`, title: 'Запись отменена', body: `${who}запись на ${when} отменена. Выберите другое время в приложении или напишите нам.` };
  }
}

/**
 * Отправить уведомление по записи. BOOKED/MORNING/HOUR — не больше одного раза;
 * если у клиента ещё нет телефона с уведомлениями, отметка не ставится (подпишется — получит).
 */
export async function notifyAppointment(appointmentId: string, kind: Kind): Promise<number> {
  const once = kind === 'BOOKED' || kind === 'MORNING' || kind === 'HOUR' || kind === 'RATE';
  if (once) {
    const claimed = await db.insert(s.appointmentNotifications).values({ appointmentId, kind })
      .onConflictDoNothing().returning();
    if (!claimed.length) return 0;
  }
  try {
    const a = await loadAppointment(appointmentId);
    if (!a) return 0;
    let delivered = await sendToClients([await payerOf(a.clientId)], await texts(a, kind));
    if (!delivered) delivered = await whatsappFor(a, kind);
    if (once) {
      if (delivered) await db.update(s.appointmentNotifications).set({ delivered })
        .where(and(eq(s.appointmentNotifications.appointmentId, appointmentId), eq(s.appointmentNotifications.kind, kind)));
      else await db.delete(s.appointmentNotifications)
        .where(and(eq(s.appointmentNotifications.appointmentId, appointmentId), eq(s.appointmentNotifications.kind, kind)));
    }
    return delivered;
  } catch (e) {
    if (once) await db.delete(s.appointmentNotifications)
      .where(and(eq(s.appointmentNotifications.appointmentId, appointmentId), eq(s.appointmentNotifications.kind, kind)));
    console.error('notify error', (e as Error).message);
    return 0;
  }
}

/** Не мешать основному действию, если уведомление не ушло */
export function notifySoon(appointmentId: string, kind: Kind) {
  return notifyAppointment(appointmentId, kind).catch(() => 0);
}

/**
 * Разослать напоминания, которым пришло время: утреннее (с 08:00 в день визита) и за час.
 * Безопасно вызывать сколько угодно раз — каждое напоминание уходит один раз.
 */
export async function runDueReminders(now = new Date()) {
  const salons = await db.query.salons.findMany();
  const result = { morning: 0, hour: 0 };
  for (const salon of salons) {
    const local = utcToZoned(now, salon.timezone);
    const appts = await db.select({ id: s.appointments.id, startsAt: s.appointments.startsAt, clientId: s.appointments.clientId, createdAt: s.appointments.createdAt })
      .from(s.appointments).where(and(
        eq(s.appointments.salonId, salon.id), occupiesTime(), eq(s.appointments.paid, false),
        gte(s.appointments.startsAt, now), lt(s.appointments.startsAt, zonedToUtc(addDays(local.date, 1), 0, salon.timezone)),
      ));
    if (!appts.length) continue;
    // напоминания только тем, у кого есть телефон с уведомлениями
    const payers = new Map<string, string>();
    for (const a of appts) payers.set(a.clientId, await payerOf(a.clientId));
    const subscribed = new Set((await db.select({ c: s.pushSubscriptions.clientId }).from(s.pushSubscriptions)
      .where(inArray(s.pushSubscriptions.clientId, [...new Set(payers.values())]))).map((r) => r.c));
    const wa = waConfigured(salon);
    for (const a of appts) {
      const push = subscribed.has(payers.get(a.clientId)!);
      // без уведомлений в приложении — только утреннее напоминание в WhatsApp (если подключён)
      if (!push && !wa) continue;
      const minutesLeft = (a.startsAt.getTime() - now.getTime()) / 60000;
      if (!push && minutesLeft <= 65) continue;
      if (minutesLeft <= 65) {
        // только что записался — подтверждение записи уже пришло, второе сообщение не нужно
        if (now.getTime() - a.createdAt.getTime() < 15 * 60000) continue;
        if (await notifyAppointment(a.id, 'HOUR')) result.hour++;
      } else if (local.minute >= MORNING_FROM) {
        if (await notifyAppointment(a.id, 'MORNING')) result.morning++;
      }
    }
  }
  return result;
}

/** Клиент нажал «Подтвердить» */
export async function confirmVisit(appointmentId: string) {
  const a = await db.query.appointments.findFirst({ where: eq(s.appointments.id, appointmentId) });
  if (!a || a.status === 'CANCELLED') throw new Error('Запись не найдена или отменена');
  if (!a.confirmedAt) {
    await db.update(s.appointments).set({ confirmedAt: new Date(), status: a.status === 'BOOKED' ? 'CONFIRMED' : a.status })
      .where(eq(s.appointments.id, a.id));
  }
  return { ok: true };
}
