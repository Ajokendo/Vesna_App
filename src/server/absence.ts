import 'server-only';
import { and, eq, gte, inArray, lt, lte, ne } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { workingHours } from '@/lib/schedule';
import { busyParts, fits } from '@/lib/slots';
import { addDays, daysBetween, utcToZoned, zonedToUtc, type DateStr } from '@/lib/time';
import { getSalon } from './salon';
import { notifySoon } from './notify';

// Мастер не выйдет (заболел, семейные дела): отметка в графике на день, несколько дней или часть дня.
// Онлайн-запись на это время сразу закрывается; уже записанных клиентов администратор
// передаёт другому мастеру, предупреждает в WhatsApp или отменяет запись.

export type AbsenceInput = {
  staffId: string;
  from: DateStr;
  to: DateStr;
  /** OFF — весь день; HOURS — работает только с start до end */
  kind: 'OFF' | 'HOURS';
  start?: number;
  end?: number;
  note?: string;
};

export async function setAbsence(slug: string, input: AbsenceInput) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  const days = daysBetween(input.from, input.to);
  if (days < 0) throw new Error('Дата «по» раньше даты «с»');
  if (days > 60) throw new Error('Не больше 60 дней за раз');
  const m = await db.query.staff.findFirst({ where: and(eq(s.staff.id, input.staffId), eq(s.staff.salonId, salon.id)), with: { schedule: true } });
  if (!m) throw new Error('Мастер не найден');
  if (input.kind === 'HOURS' && (input.start == null || input.end == null || input.end <= input.start)) {
    throw new Error('Укажите, с какого и до какого времени мастер работает');
  }
  const note = input.note?.trim() || null;
  let changed = 0;
  for (let i = 0; i <= days; i++) {
    const date = addDays(input.from, i);
    // в обычный выходной отмечать нечего
    if (!workingHours(m.schedule ?? null, [], date)) continue;
    const values = input.kind === 'OFF'
      ? { dayOff: true, startMinute: null, endMinute: null, note }
      : { dayOff: false, startMinute: input.start!, endMinute: input.end!, note };
    await db.insert(s.scheduleExceptions).values({ staffId: m.id, date, ...values })
      .onConflictDoUpdate({ target: [s.scheduleExceptions.staffId, s.scheduleExceptions.date], set: values });
    changed++;
  }
  if (!changed) throw new Error('В эти дни мастер и так не работает по графику');
  return { changed };
}

/** Мастер выходит в свой выходной (подменяет коллегу или поменялись выходными) */
export async function setExtraDay(slug: string, input: { staffId: string; date: DateStr; start: number; end: number; note?: string }) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  if (input.end <= input.start) throw new Error('Укажите, с какого и до какого времени мастер работает');
  const m = await db.query.staff.findFirst({ where: and(eq(s.staff.id, input.staffId), eq(s.staff.salonId, salon.id)), with: { schedule: true } });
  if (!m) throw new Error('Мастер не найден');
  if (!m.schedule) throw new Error('У мастера нет графика');
  const values = { dayOff: false, startMinute: input.start, endMinute: input.end, note: input.note?.trim() || null };
  await db.insert(s.scheduleExceptions).values({ staffId: m.id, date: input.date, ...values })
    .onConflictDoUpdate({ target: [s.scheduleExceptions.staffId, s.scheduleExceptions.date], set: values });
}

/** Вернуть обычный график на день */
export async function clearAbsence(slug: string, staffId: string, date: DateStr) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  const m = await db.query.staff.findFirst({ where: and(eq(s.staff.id, staffId), eq(s.staff.salonId, salon.id)) });
  if (!m) throw new Error('Мастер не найден');
  await db.delete(s.scheduleExceptions).where(and(eq(s.scheduleExceptions.staffId, m.id), eq(s.scheduleExceptions.date, date)));
}

/** Передать запись другому мастеру — только тому, кто делает эту услугу и свободен в это время */
export async function reassignAppointment(slug: string, appointmentId: string, toStaffId: string) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(s.appointments)
      .where(and(eq(s.appointments.id, appointmentId), eq(s.appointments.salonId, salon.id))).for('update');
    if (!a || a.status === 'CANCELLED') throw new Error('Запись не найдена');
    if (a.paid) throw new Error('Запись уже оплачена');
    await tx.select({ id: s.staff.id }).from(s.staff).where(eq(s.staff.id, toStaffId)).for('update');
    const svc = await tx.query.services.findFirst({ where: eq(s.services.id, a.serviceId), with: { category: { with: { staff: true } }, restrictions: true } });
    const only = svc?.restrictions.map((r) => r.staffId) ?? [];
    const can = svc?.category.staff.some((x) => x.staffId === toStaffId) && (!only.length || only.includes(toStaffId));
    if (!can) throw new Error('Этот мастер не делает эту услугу');

    const { date, minute } = utcToZoned(a.startsAt, salon.timezone);
    const dur = Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60000);
    const pause = a.pauseStart != null && a.pauseMin ? { after: a.pauseStart, min: a.pauseMin } : null;
    const m = await tx.query.staff.findFirst({ where: eq(s.staff.id, toStaffId), with: { schedule: true, exceptions: true } });
    const day = workingHours(m?.schedule ?? null, (m?.exceptions ?? []).map((e) => ({ ...e, date: String(e.date) })), date);
    if (!day) throw new Error(`${m?.name ?? 'Мастер'} в этот день не работает`);
    const others = await tx.select().from(s.appointments).where(and(
      eq(s.appointments.staffId, toStaffId), ne(s.appointments.status, 'CANCELLED'), ne(s.appointments.id, a.id),
      gte(s.appointments.startsAt, zonedToUtc(date, 0, salon.timezone)), lt(s.appointments.startsAt, zonedToUtc(addDays(date, 1), 0, salon.timezone)),
    ));
    const busy = others.flatMap((o) => busyParts(
      utcToZoned(o.startsAt, salon.timezone).minute, utcToZoned(o.endsAt, salon.timezone).minute,
      o.pauseStart != null && o.pauseMin ? { after: o.pauseStart, min: o.pauseMin } : null,
    ));
    if (!fits(day, busy, minute, dur, pause)) throw new Error(`${m?.name ?? 'Мастер'} в это время занят`);
    await tx.update(s.appointments).set({ staffId: toStaffId }).where(eq(s.appointments.id, a.id));
    return { staffId: toStaffId, id: a.id };
  }).then(async (r) => { await notifySoon(r.id, 'MOVED'); return { staffId: r.staffId }; });
}

/** Отменить неоплаченную запись */
export async function cancelAppointment(slug: string, appointmentId: string) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  const a = await db.query.appointments.findFirst({ where: and(eq(s.appointments.id, appointmentId), eq(s.appointments.salonId, salon.id)) });
  if (!a) throw new Error('Запись не найдена');
  if (a.paid) throw new Error('Запись уже оплачена — сначала отмените оплату');
  await db.update(s.appointments).set({ status: 'CANCELLED' }).where(eq(s.appointments.id, a.id));
  await notifySoon(a.id, 'CANCELLED');
}

/** Отметки «не выйдет» на ближайшие дни — для списка в журнале */
export async function upcomingAbsences(salonId: string, from: DateStr, to: DateStr) {
  const staff = await db.query.staff.findMany({ where: eq(s.staff.salonId, salonId) });
  if (!staff.length) return [];
  const rows = await db.select().from(s.scheduleExceptions).where(and(
    inArray(s.scheduleExceptions.staffId, staff.map((m) => m.id)),
    gte(s.scheduleExceptions.date, from), lte(s.scheduleExceptions.date, to),
  ));
  return rows.map((r) => ({ ...r, date: String(r.date), name: staff.find((m) => m.id === r.staffId)?.name ?? '' }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Мастер закончит раньше или задержится: администратор меняет время окончания записи.
 * Нельзя наехать на следующего клиента этого мастера — тогда подсказываем, кто следующий.
 */
export async function setAppointmentEnd(slug: string, appointmentId: string, endMinute: number, by: { role: 'ADMIN' } | { role: 'MASTER'; staffId: string } = { role: 'ADMIN' }) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(s.appointments)
      .where(and(eq(s.appointments.id, appointmentId), eq(s.appointments.salonId, salon.id))).for('update');
    if (!a || a.status === 'CANCELLED') throw new Error('Запись не найдена');
    if (by.role === 'MASTER' && a.staffId !== by.staffId) throw new Error('Это не ваша запись');
    const staffRow = await tx.query.staff.findFirst({ where: eq(s.staff.id, a.staffId) });
    await tx.select({ id: s.staff.id }).from(s.staff).where(eq(s.staff.id, a.staffId)).for('update');
    const { date, minute: start } = utcToZoned(a.startsAt, salon.timezone);
    if (endMinute < start + 5) throw new Error('Запись не может длиться меньше 5 минут');
    if (endMinute > 24 * 60) throw new Error('Окончание — не позже 24:00');
    const others = await tx.query.appointments.findMany({
      where: and(eq(s.appointments.staffId, a.staffId), ne(s.appointments.status, 'CANCELLED'), ne(s.appointments.id, a.id),
        gte(s.appointments.startsAt, zonedToUtc(date, 0, salon.timezone)), lt(s.appointments.startsAt, zonedToUtc(addDays(date, 1), 0, salon.timezone))),
      with: { client: true },
    });
    // выдержка краски остаётся, только если запись не стала короче неё
    const keepPause = a.pauseStart != null && a.pauseMin != null && start + a.pauseStart + a.pauseMin < endMinute;
    const pause = keepPause ? { after: a.pauseStart!, min: a.pauseMin! } : null;
    const mine = busyParts(start, endMinute, pause);
    for (const o of others) {
      const os = utcToZoned(o.startsAt, salon.timezone).minute;
      const oe = utcToZoned(o.endsAt, salon.timezone).minute;
      const theirs = busyParts(os, oe, o.pauseStart != null && o.pauseMin ? { after: o.pauseStart, min: o.pauseMin } : null);
      if (mine.some((p) => theirs.some((q) => p.start < q.end && p.end > q.start))) {
        const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        throw new Error(`В ${hh(os)} у мастера следующий клиент — ${o.client.name}. Можно продлить максимум до ${hh(os)} или сначала передать этого клиента другому мастеру.`);
      }
    }
    await tx.update(s.appointments).set({
      endsAt: zonedToUtc(date, endMinute, salon.timezone),
      plannedEndsAt: a.plannedEndsAt ?? a.endsAt,
      endChangedBy: by.role === 'MASTER' ? `MASTER:${staffRow?.name ?? ''}` : 'ADMIN',
      endChangedAt: new Date(),
      ...(keepPause ? {} : { pauseStart: null, pauseMin: null }),
    }).where(eq(s.appointments.id, a.id));
    return { end: endMinute };
  });
}
