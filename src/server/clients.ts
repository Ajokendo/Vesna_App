import 'server-only';
import { and, desc, eq, gte, ilike, inArray, lt, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema as s } from '@/db';
import { workingHours } from '@/lib/schedule';
import { availableStarts, busyParts, fits } from '@/lib/slots';
import { addDays, utcToZoned, zonedToUtc, type DateStr } from '@/lib/time';
import { getSalon } from './salon';
import { notifySoon } from './notify';
import { occupiesTime } from './status';
import { checkWaitlistFor } from './waitlist';

// База клиентов для администратора: поиск по телефону или имени, карточка с историей визитов и заметкой,
// перенос записи на другое время (или к другому мастеру) в одно касание.

async function salonOf(slug: string) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  return salon;
}

const lengthName: Record<string, string> = { SHORT: 'короткие', MEDIUM: 'средние', LONG: 'длинные', XLONG: 'очень длинные' };

/** Поиск: цифры — по телефону (любая часть номера), буквы — по имени. Пустой запрос — недавние клиенты */
export async function searchClients(slug: string, q: string) {
  const salon = await salonOf(slug);
  const query = q.trim();
  const digits = query.replace(/\D/g, '');
  const cond = !query ? undefined
    : digits.length >= 3 && digits.length >= query.replace(/[\s+()-]/g, '').length - 1
      ? ilike(s.clients.phone, `%${digits}%`)
      : ilike(s.clients.name, `%${query.replace(/[%_]/g, '')}%`);
  const lastVisit = sql<Date | null>`max(${s.appointments.startsAt}) filter (where ${s.appointments.status} not in ('CANCELLED','NO_SHOW'))`;
  const rows = await db.select({
    id: s.clients.id, name: s.clients.name, phone: s.clients.phone, points: s.clients.points, guardianId: s.clients.guardianId,
    visits: sql<number>`count(${s.appointments.id}) filter (where ${s.appointments.paid})`.mapWith(Number),
    noShows: sql<number>`count(${s.appointments.id}) filter (where ${s.appointments.status} = 'NO_SHOW')`.mapWith(Number),
    lastVisit,
  }).from(s.clients)
    .leftJoin(s.appointments, eq(s.appointments.clientId, s.clients.id))
    .where(and(eq(s.clients.salonId, salon.id), cond))
    .groupBy(s.clients.id)
    .orderBy(sql`${lastVisit} desc nulls last`, desc(s.clients.createdAt))
    .limit(40);
  // у детей телефона нет — показываем телефон родителя
  const guardianIds = [...new Set(rows.map((r) => r.guardianId).filter(Boolean))] as string[];
  const guardians = guardianIds.length ? await db.query.clients.findMany({ where: inArray(s.clients.id, guardianIds) }) : [];
  return rows.map((r) => {
    const g = guardians.find((x) => x.id === r.guardianId);
    return {
      id: r.id, name: r.name, phone: r.phone ?? g?.phone ?? null, guardian: g?.name ?? null, points: g ? g.points : r.points,
      visits: r.visits, noShows: r.noShows,
      lastVisit: r.lastVisit ? utcToZoned(new Date(r.lastVisit), salon.timezone).date : null,
    };
  });
}

/** Карточка клиента: данные, баллы, дети, предстоящие и прошлые визиты */
export async function getClientCard(slug: string, id: string) {
  const salon = await salonOf(slug);
  const c = await db.query.clients.findFirst({
    where: and(eq(s.clients.id, id), eq(s.clients.salonId, salon.id)),
    with: { guardian: true, family: true },
  });
  if (!c) return null;
  const appts = await db.query.appointments.findMany({
    where: eq(s.appointments.clientId, c.id),
    with: { staff: true, service: { with: { category: true } }, addons: { with: { addon: true } } },
    orderBy: desc(s.appointments.startsAt),
  });
  const now = new Date();
  const items = appts.map((a) => {
    const z = utcToZoned(a.startsAt, salon.timezone);
    return {
      id: a.id, date: z.date, start: z.minute, end: utcToZoned(a.endsAt, salon.timezone).minute,
      staff: a.staff.name, staffId: a.staffId,
      service: a.service.name + (a.hairLength ? ` (${lengthName[a.hairLength]})` : ''),
      addons: a.addons.map((x) => x.addon.name),
      price: a.paid ? (a.finalPrice ?? a.price) : a.price, priceMax: a.paid ? null : a.priceMax,
      paid: a.paid, cash: a.cashPaid, pointsUsed: a.pointsUsed, status: a.status, cancelledBy: a.cancelledBy,
      upcoming: !a.paid && a.startsAt > new Date(now.getTime() - 3 * 3600_000) && a.status !== 'CANCELLED' && a.status !== 'NO_SHOW',
    };
  });
  const payer = c.guardian ?? c;
  return {
    salonName: salon.name,
    client: {
      id: c.id, name: c.name, phone: c.phone, birthDate: c.birthDate ? String(c.birthDate) : null, note: c.note,
      promoOptOut: c.promoOptOut, createdAt: utcToZoned(c.createdAt, salon.timezone).date,
    },
    guardian: c.guardian ? { id: c.guardian.id, name: c.guardian.name, phone: c.guardian.phone } : null,
    children: c.family.map((x) => ({ id: x.id, name: x.name, birthDate: x.birthDate ? String(x.birthDate) : null })),
    points: { balance: payer.points, owner: payer.name, own: !c.guardian },
    stats: {
      visits: items.filter((i) => i.paid).length,
      spent: items.reduce((n, i) => n + (i.paid ? (i.cash ?? 0) : 0), 0),
      noShows: items.filter((i) => i.status === 'NO_SHOW').length,
      cancelled: items.filter((i) => i.status === 'CANCELLED').length,
      favorite: favorite(items.filter((i) => i.paid).map((i) => i.staff)),
    },
    upcoming: items.filter((i) => i.upcoming).reverse(),
    history: items.filter((i) => !i.upcoming),
  };
}

function favorite(names: string[]) {
  const m = new Map<string, number>();
  for (const n of names) m.set(n, (m.get(n) ?? 0) + 1);
  const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0] : null;
}

export const ClientEdit = z.object({
  name: z.string().trim().min(2).max(60),
  phone: z.string().trim().max(30).nullable(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  note: z.string().trim().max(1000).nullable(),
});

export async function updateClient(slug: string, id: string, input: z.infer<typeof ClientEdit>) {
  const salon = await salonOf(slug);
  const c = await db.query.clients.findFirst({ where: and(eq(s.clients.id, id), eq(s.clients.salonId, salon.id)) });
  if (!c) throw new Error('Клиент не найден');
  let phone = input.phone ? input.phone.replace(/[^\d+]/g, '') : null;
  if (phone && phone.replace(/\D/g, '').length < 9) throw new Error('Проверьте номер телефона');
  if (c.guardianId) phone = null; // у ребёнка — телефон родителя
  if (phone && phone !== c.phone) {
    const other = await db.query.clients.findFirst({ where: and(eq(s.clients.salonId, salon.id), eq(s.clients.phone, phone), ne(s.clients.id, c.id)) });
    if (other) throw new Error(`Этот номер уже у клиента «${other.name}»`);
  }
  await db.update(s.clients).set({ name: input.name, phone: c.guardianId ? c.phone : phone, birthDate: input.birthDate, note: input.note || null })
    .where(eq(s.clients.id, c.id));
  return { ok: true };
}

// ——— перенос записи ———

async function loadForMove(salonId: string, appointmentId: string) {
  const a = await db.query.appointments.findFirst({
    where: and(eq(s.appointments.id, appointmentId), eq(s.appointments.salonId, salonId)),
    with: { service: { with: { category: { with: { staff: true } }, restrictions: true } }, staff: true },
  });
  if (!a || a.status === 'CANCELLED') throw new Error('Запись не найдена или отменена');
  if (a.paid) throw new Error('Запись уже оплачена — переносить нечего');
  const only = a.service.restrictions.map((r) => r.staffId);
  const eligible = a.service.category.staff.map((x) => x.staffId).filter((id) => !only.length || only.includes(id));
  return {
    a, eligible,
    dur: Math.round(((a.plannedEndsAt ?? a.endsAt).getTime() - a.startsAt.getTime()) / 60000),
    pause: a.pauseStart != null && a.pauseMin ? { after: a.pauseStart, min: a.pauseMin } : null,
  };
}

async function staffBusy(staffIds: string[], date: DateStr, tz: string, exceptId: string) {
  const [members, appts] = await Promise.all([
    db.query.staff.findMany({ where: and(inArray(s.staff.id, staffIds), eq(s.staff.active, true)), with: { schedule: true, exceptions: true } }),
    db.select().from(s.appointments).where(and(
      inArray(s.appointments.staffId, staffIds), occupiesTime(), ne(s.appointments.id, exceptId),
      gte(s.appointments.startsAt, zonedToUtc(date, 0, tz)), lt(s.appointments.startsAt, zonedToUtc(addDays(date, 1), 0, tz)),
    )),
  ]);
  return members.sort((x, y) => x.sortOrder - y.sortOrder).map((m) => ({
    id: m.id, name: m.name, photoUrl: m.photoUrl,
    day: workingHours(m.schedule ?? null, m.exceptions.map((e) => ({ ...e, date: String(e.date) })), date),
    busy: appts.filter((x) => x.staffId === m.id).flatMap((x) => busyParts(
      utcToZoned(x.startsAt, tz).minute, utcToZoned(x.endsAt, tz).minute,
      x.pauseStart != null && x.pauseMin ? { after: x.pauseStart, min: x.pauseMin } : null,
    )),
  }));
}

/** Клиент может сам перенести запись не позже чем за столько часов до начала (дальше — звонок в салон) */
export const CLIENT_MOVE_HOURS = 2;

/** Свободное время для переноса на выбранный день: сначала у того же мастера, затем у других, кто делает эту услугу.
 *  Для клиента — как в онлайн-записи: не раньше чем через «не позже чем за N минут» и не дальше горизонта записи */
export async function rescheduleOptions(slug: string, appointmentId: string, date: DateStr, by: 'ADMIN' | 'CLIENT' = 'ADMIN') {
  const salon = await salonOf(slug);
  const { a, eligible, dur, pause } = await loadForMove(salon.id, appointmentId);
  const now = utcToZoned(new Date(), salon.timezone);
  const current = utcToZoned(a.startsAt, salon.timezone);
  const tooFar = by === 'CLIENT' && date > addDays(now.date, salon.bookingHorizonDays - 1);
  if (date < now.date || tooFar) return { date, current: { date: current.date, minute: current.minute, staffId: a.staffId }, masters: [] };
  const ids = [a.staffId, ...eligible.filter((id) => id !== a.staffId)];
  const members = await staffBusy(ids, date, salon.timezone, a.id);
  members.sort((x, y) => (x.id === a.staffId ? -1 : y.id === a.staffId ? 1 : 0));
  return {
    date, durationMin: dur,
    current: { date: current.date, minute: current.minute, staffId: a.staffId },
    masters: members.map((m) => ({
      id: m.id, name: m.name, photoUrl: m.photoUrl, same: m.id === a.staffId,
      hours: m.day ? { start: m.day.start, end: m.day.end } : null,
      starts: m.day ? availableStarts({
        day: m.day, durationMin: dur, pause, busy: m.busy, stepMin: salon.slotStepMinutes, displayStepMin: salon.displayStepMinutes,
        earliestMin: date === now.date ? now.minute + (by === 'CLIENT' ? salon.minLeadMinutes : 0) : undefined,
      }).filter((t) => !(date === current.date && t === current.minute && m.id === a.staffId)) : [],
    })),
  };
}

/** Перенести запись: новое время и (необязательно) другой мастер. Клиент получает уведомление «Ваша запись изменилась» */
export async function rescheduleAppointment(slug: string, appointmentId: string, to: { staffId: string; date: DateStr; minute: number }, by: 'ADMIN' | 'CLIENT' = 'ADMIN') {
  const salon = await salonOf(slug);
  const moved = await db.transaction(async (tx) => {
    const { a, eligible, dur, pause } = await loadForMove(salon.id, appointmentId);
    if (by === 'CLIENT') {
      if (a.status === 'NO_SHOW') throw new Error('Запись закрыта');
      if (a.startsAt.getTime() - Date.now() < CLIENT_MOVE_HOURS * 3600e3) throw new Error(`Перенести самостоятельно можно не позже чем за ${CLIENT_MOVE_HOURS} часа — позвоните в салон`);
      const nowZ = utcToZoned(new Date(), salon.timezone);
      if (to.date > addDays(nowZ.date, salon.bookingHorizonDays - 1)) throw new Error('На этот день запись ещё не открыта');
      if (to.date === nowZ.date && to.minute < nowZ.minute + salon.minLeadMinutes) throw new Error('Это время уже слишком близко — выберите позже');
    }
    if (to.staffId !== a.staffId && !eligible.includes(to.staffId)) throw new Error('Этот мастер не делает эту услугу');
    await tx.select({ id: s.staff.id }).from(s.staff).where(inArray(s.staff.id, [a.staffId, to.staffId])).for('update');
    const now = utcToZoned(new Date(), salon.timezone);
    if (to.date < now.date || (to.date === now.date && to.minute < now.minute - 5)) throw new Error('Это время уже прошло');
    const [m] = await staffBusy([to.staffId], to.date, salon.timezone, a.id);
    if (!m?.day) throw new Error(`${m?.name ?? 'Мастер'} в этот день не работает`);
    if (!fits(m.day, m.busy, to.minute, dur, pause)) throw new Error('Это время уже занято, выберите другое');
    const startsAt = zonedToUtc(to.date, to.minute, salon.timezone);
    await tx.update(s.appointments).set({
      staffId: to.staffId, startsAt, endsAt: new Date(startsAt.getTime() + dur * 60000),
      plannedEndsAt: null, endChangedBy: null, endChangedAt: null,
      confirmedAt: null, arrivedAt: null, lateMinutes: null, lateReportedAt: null,
      status: a.status === 'CONFIRMED' ? 'BOOKED' : a.status,
    }).where(eq(s.appointments.id, a.id));
    // утреннее напоминание и «через час» придут заново — уже к новому времени
    await tx.delete(s.appointmentNotifications).where(and(
      eq(s.appointmentNotifications.appointmentId, a.id), inArray(s.appointmentNotifications.kind, ['MORNING', 'HOUR']),
    ));
    return { id: a.id, staffId: to.staffId, date: to.date, minute: to.minute, old: { salonId: a.salonId, startsAt: a.startsAt } };
  });
  // клиент перенёс сам — уведомлять его об этом не нужно
  if (by === 'ADMIN') await notifySoon(moved.id, 'MOVED');
  // на прежнем месте освободилось время — вдруг его кто-то ждёт
  await checkWaitlistFor(moved.old);
  return moved;
}

