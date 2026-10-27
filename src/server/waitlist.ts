import 'server-only';
import { and, asc, eq, gte, inArray, isNull, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema as s } from '@/db';
import { getSalon, getSlots } from './salon';
import { getMe } from './me';
import { sendToClients } from './push';
import { sendWa } from './whatsapp';
import { addDays, dayMonth, hhmm, utcToZoned, weekdayShort, type DateStr } from '@/lib/time';

// Лист ожидания. Клиент на шаге «Дата и время» просит сообщить, если в выбранный день освободится время.
// Когда запись на этот день отменяют, переносят или отмечают «не пришёл», приложение проверяет ожидающих:
// если для их услуги и мастера появилось окно — им приходит уведомление со ссылкой, где уже выбраны услуга, мастер и день.
// Администратор видит лист ожидания на день над журналом и может позвонить сам.

const RENOTIFY_MIN = 20; // повторно сообщить тому же клиенту не раньше чем через 20 минут

export const JoinInput = z.object({
  serviceId: z.string().min(1),
  staffId: z.string().min(1), // 'any' — любой мастер
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  length: z.enum(['SHORT', 'MEDIUM', 'LONG', 'XLONG']).nullable().optional(),
  addonIds: z.array(z.string()).default([]),
  client: z.object({
    name: z.string().trim().min(2, 'Укажите имя'),
    phone: z.string().trim().regex(/^\+?\d[\d\s()-]{8,}$/, 'Проверьте номер телефона'),
  }),
});

async function salonOf(slug: string) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  return salon;
}

/** Встать в лист ожидания. Возвращает id клиента (чтобы телефон его запомнил) */
export async function joinWaitlist(slug: string, input: z.infer<typeof JoinInput>) {
  const salon = await salonOf(slug);
  const today = utcToZoned(new Date(), salon.timezone).date;
  if (input.date < today || input.date > addDays(today, salon.bookingHorizonDays - 1)) throw new Error('На этот день записаться нельзя');
  const svc = await db.query.services.findFirst({ where: eq(s.services.id, input.serviceId), with: { category: true } });
  if (!svc || svc.category.salonId !== salon.id) throw new Error('Услуга не найдена');
  const staffId = input.staffId === 'any' ? null : input.staffId;
  if (staffId && !(await db.query.staff.findFirst({ where: and(eq(s.staff.id, staffId), eq(s.staff.salonId, salon.id)) }))) throw new Error('Мастер не найден');

  const phone = input.client.phone.replace(/[^\d+]/g, '');
  let client = await db.query.clients.findFirst({ where: and(eq(s.clients.salonId, salon.id), eq(s.clients.phone, phone)) });
  if (!client) [client] = await db.insert(s.clients).values({ salonId: salon.id, name: input.client.name, phone }).returning();

  const same = await db.query.waitlist.findFirst({ where: and(
    eq(s.waitlist.clientId, client.id), eq(s.waitlist.date, input.date), eq(s.waitlist.serviceId, svc.id), isNull(s.waitlist.closedAt),
    staffId ? eq(s.waitlist.staffId, staffId) : isNull(s.waitlist.staffId),
  ) });
  if (!same) {
    await db.insert(s.waitlist).values({
      salonId: salon.id, clientId: client.id, serviceId: svc.id, staffId, date: input.date,
      hairLength: input.length ?? null, addonIds: input.addonIds,
    });
  }
  return { clientId: client.id };
}

const label = (w: { staff: { name: string } | null; service: { name: string } }) => `${w.service.name}${w.staff ? ` · ${w.staff.name}` : ' · любой мастер'}`;

/** Мои заявки (с сегодняшнего дня) — для «Моих записей» */
export async function myWaitlist(slug: string) {
  const me = await getMe(slug);
  if (!me) return [];
  const today = utcToZoned(new Date(), me.salon.timezone).date;
  const rows = await db.query.waitlist.findMany({
    where: and(eq(s.waitlist.clientId, me.client.id), isNull(s.waitlist.closedAt), gte(s.waitlist.date, today)),
    with: { service: true, staff: true }, orderBy: asc(s.waitlist.date),
  });
  return rows.map((w) => ({ id: w.id, date: w.date, title: label(w), notified: !!w.notifiedAt }));
}

/** Закрыть заявку: клиент (только свою) или администратор */
export async function closeWaitlist(slug: string, id: string, by: 'CLIENT' | 'ADMIN') {
  const salon = await salonOf(slug);
  const w = await db.query.waitlist.findFirst({ where: and(eq(s.waitlist.id, id), eq(s.waitlist.salonId, salon.id)) });
  if (!w) throw new Error('Заявка не найдена');
  if (by === 'CLIENT') {
    const me = await getMe(slug);
    if (!me || me.client.id !== w.clientId) throw new Error('Это не ваша заявка');
  }
  await db.update(s.waitlist).set({ closedAt: new Date() }).where(eq(s.waitlist.id, id));
}

/** Лист ожидания на день — для журнала администратора */
export async function dayWaitlist(salonId: string, date: DateStr) {
  const rows = await db.query.waitlist.findMany({
    where: and(eq(s.waitlist.salonId, salonId), eq(s.waitlist.date, date), isNull(s.waitlist.closedAt)),
    with: { service: true, staff: true, client: true }, orderBy: asc(s.waitlist.createdAt),
  });
  return rows.map((w) => ({ id: w.id, client: w.client.name, clientId: w.clientId, phone: w.client.phone, title: label(w), notified: !!w.notifiedAt }));
}

/** Клиент записался на этот день — его заявки на этот день больше не нужны */
export async function closeWaitlistOnBooking(salonId: string, clientIds: string[], date: DateStr) {
  if (!clientIds.length) return;
  await db.update(s.waitlist).set({ closedAt: new Date() })
    .where(and(eq(s.waitlist.salonId, salonId), inArray(s.waitlist.clientId, clientIds), eq(s.waitlist.date, date), isNull(s.waitlist.closedAt)));
}

/** Время в этот день освободилось — сообщить подходящим ожидающим. Возвращает, скольким сообщили */
export async function checkWaitlist(salonId: string, date: DateStr) {
  const salon = await db.query.salons.findFirst({ where: eq(s.salons.id, salonId) });
  if (!salon) return 0;
  const today = utcToZoned(new Date(), salon.timezone).date;
  if (date < today) return 0;
  const recent = new Date(Date.now() - RENOTIFY_MIN * 60000);
  const rows = await db.query.waitlist.findMany({
    where: and(eq(s.waitlist.salonId, salonId), eq(s.waitlist.date, date), isNull(s.waitlist.closedAt),
      or(isNull(s.waitlist.notifiedAt), lt(s.waitlist.notifiedAt, recent))),
    with: { service: true, staff: true, client: true }, orderBy: asc(s.waitlist.createdAt),
  });
  let sent = 0;
  for (const w of rows) {
    const { slots } = await getSlots(salon.slug, { serviceId: w.serviceId, staffId: w.staffId ?? 'any', date, length: w.hairLength, addonIds: w.addonIds });
    if (!slots.length) continue;
    const times = slots.slice(0, 3).map((t) => hhmm(t.minute)).join(', ');
    const p = new URLSearchParams({ service: w.serviceId, date });
    if (w.staffId) p.set('staff', w.staffId); else p.set('any', '1');
    if (w.hairLength) p.set('length', w.hairLength);
    if (w.addonIds.length) p.set('addons', w.addonIds.join(','));
    const pushed = await sendToClients([w.clientId], {
      title: `Освободилось время${w.staff ? ` у мастера ${w.staff.name}` : ''}`,
      body: `${weekdayShort(date)}, ${dayMonth(date)}: ${times}${slots.length > 3 ? ' и другое' : ''}. ${w.service.name} — нажмите, чтобы записаться, пока не заняли.`,
      url: `/${salon.slug}/book?${p}`,
      tag: `waitlist-${w.id}`,
    }).catch((e) => { console.error('waitlist push', (e as Error).message); return 0; });
    if (!pushed) {
      await sendWa(salon, {
        clientId: w.clientId, phone: w.client.phone, template: 'slot',
        params: [w.client.name.split(' ')[0], salon.name, `${weekdayShort(date)}, ${dayMonth(date)}: ${times}`, `${w.service.name}${w.staff ? `, мастер ${w.staff.name}` : ''}`],
        urlSuffix: `${salon.slug}/book?${p}`,
      }).catch(() => false);
    }
    await db.update(s.waitlist).set({ notifiedAt: new Date() }).where(eq(s.waitlist.id, w.id));
    sent++;
  }
  return sent;
}

/** Освободилось время у записи (по её id) — проверить лист ожидания на её день */
export async function checkWaitlistFor(appointment: { salonId: string; startsAt: Date }) {
  const salon = await db.query.salons.findFirst({ where: eq(s.salons.id, appointment.salonId), columns: { timezone: true } });
  if (!salon) return 0;
  return checkWaitlist(appointment.salonId, utcToZoned(appointment.startsAt, salon.timezone).date).catch((e) => { console.error('waitlist', (e as Error).message); return 0; });
}
