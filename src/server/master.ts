import 'server-only';
import { and, asc, eq, gte, lt, ne } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { workingHours, workDaysLabel } from '@/lib/schedule';
import { addDays, utcToZoned, zonedToUtc, type DateStr } from '@/lib/time';

type Salon = typeof s.salons.$inferSelect;
type Staff = typeof s.staff.$inferSelect;

const lengthName: Record<string, string> = { SHORT: 'короткие', MEDIUM: 'средние', LONG: 'длинные', XLONG: 'очень длинные' };

export function masterPercentOf(m: Staff, salon: Salon) {
  return m.roles.includes('OWNER') ? 0 : (m.commission ?? salon.defaultCommission);
}

async function appointmentsBetween(salon: Salon, staffId: string, from: DateStr, toExclusive: DateStr) {
  return db.query.appointments.findMany({
    where: and(
      eq(s.appointments.staffId, staffId), ne(s.appointments.status, 'CANCELLED'),
      gte(s.appointments.startsAt, zonedToUtc(from, 0, salon.timezone)),
      lt(s.appointments.startsAt, zonedToUtc(toExclusive, 0, salon.timezone)),
    ),
    with: { client: true, service: { with: { category: true } }, addons: { with: { addon: true } } },
    orderBy: asc(s.appointments.startsAt),
  });
}

/** День мастера: часы работы, записи (услуга из прайса) и заработок по каждому клиенту */
export async function getMasterDay(salon: Salon, m: Staff, date: DateStr) {
  const [full, appts] = await Promise.all([
    db.query.staff.findFirst({ where: eq(s.staff.id, m.id), with: { schedule: true, exceptions: true } }),
    appointmentsBetween(salon, m.id, date, addDays(date, 1)),
  ]);
  const exceptions = (full?.exceptions ?? []).map((e) => ({ ...e, date: String(e.date) }));
  const percent = masterPercentOf(m, salon);
  const items = appts.map((a) => {
    const start = utcToZoned(a.startsAt, salon.timezone).minute;
    const end = utcToZoned(a.endsAt, salon.timezone).minute;
    return {
      id: a.id, start, end,
      client: a.client.name,
      category: a.service.category.name,
      service: a.service.name + (a.hairLength ? ` (${lengthName[a.hairLength]})` : ''),
      addons: a.addons.map((x) => ({ name: x.addon.name, price: x.price })),
      pause: a.pauseStart != null && a.pauseMin ? { from: start + a.pauseStart, to: start + a.pauseStart + a.pauseMin } : null,
      /** Время окончания меняли — каким оно было по записи */
      plannedEnd: a.plannedEndsAt ? utcToZoned(a.plannedEndsAt, salon.timezone).minute : null,
      endChangedByMaster: !!a.endChangedBy?.startsWith('MASTER'),
      status: a.status,
      arrived: !!a.arrivedAt,
      lateMinutes: a.lateMinutes,
      price: a.price, priceMax: a.priceMax,
      paid: a.paid,
      finalPrice: a.finalPrice ?? a.price,
      pointsUsed: a.pointsUsed,
      cash: a.cashPaid ?? 0,
      percent: a.masterPercent ?? percent,
      share: a.masterShare ?? 0,
      /** Доля, если бы клиент заплатил всё деньгами — чтобы было видно, сколько «съели» баллы */
      shareWithoutPoints: Math.round(((a.finalPrice ?? a.price) * (a.masterPercent ?? percent)) / 100),
    };
  });
  const paid = items.filter((i) => i.paid);
  return {
    date,
    hours: workingHours(full?.schedule ?? null, exceptions, date),
    scheduleLabel: workDaysLabel(full?.schedule ?? null),
    percent,
    items,
    totals: {
      visits: paid.length,
      price: paid.reduce((n, i) => n + i.finalPrice, 0),
      points: paid.reduce((n, i) => n + i.pointsUsed, 0),
      cash: paid.reduce((n, i) => n + i.cash, 0),
      share: paid.reduce((n, i) => n + i.share, 0),
      waiting: items.filter((i) => !i.paid && i.status !== 'NO_SHOW').length,
    },
  };
}

/** Ближайшие 7 дней: рабочие часы и число записей */
export async function getMasterWeek(salon: Salon, m: Staff, from: DateStr) {
  const [full, appts] = await Promise.all([
    db.query.staff.findFirst({ where: eq(s.staff.id, m.id), with: { schedule: true, exceptions: true } }),
    appointmentsBetween(salon, m.id, from, addDays(from, 7)),
  ]);
  const exceptions = (full?.exceptions ?? []).map((e) => ({ ...e, date: String(e.date) }));
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(from, i);
    return {
      date,
      hours: workingHours(full?.schedule ?? null, exceptions, date),
      count: appts.filter((a) => utcToZoned(a.startsAt, salon.timezone).date === date).length,
    };
  });
}

/** Заработок с начала месяца по дням */
export async function getMasterMonth(salon: Salon, m: Staff, date: DateStr) {
  const first = `${date.slice(0, 8)}01`;
  const [y, mo] = date.split('-').map(Number);
  const next = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`;
  const appts = (await appointmentsBetween(salon, m.id, first, next)).filter((a) => a.paid);
  return {
    month: first,
    visits: appts.length,
    price: appts.reduce((n, a) => n + (a.finalPrice ?? a.price), 0),
    points: appts.reduce((n, a) => n + a.pointsUsed, 0),
    cash: appts.reduce((n, a) => n + (a.cashPaid ?? 0), 0),
    share: appts.reduce((n, a) => n + (a.masterShare ?? 0), 0),
  };
}

/** Мастера для экрана входа и для выдачи PIN */
export async function getMastersForLogin(salonId: string) {
  const rows = await db.query.staff.findMany({
    where: and(eq(s.staff.salonId, salonId), eq(s.staff.active, true)),
    orderBy: asc(s.staff.sortOrder),
  });
  return rows.filter((m) => m.roles.includes('MASTER')).map((m) => ({
    id: m.id, name: m.name, title: m.title, photoUrl: m.photoUrl, hasPin: !!m.pinHash, isOwner: m.roles.includes('OWNER'),
    locked: !!m.pinLockedUntil && m.pinLockedUntil > new Date(),
  }));
}
