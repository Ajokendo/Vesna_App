import 'server-only';
import { and, asc, eq, gte, inArray, lt, ne } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import type { HairLength } from '@/db/schema';
import { workingHours, workDaysLabel } from '@/lib/schedule';
import { availableStarts, busyParts, fits } from '@/lib/slots';
import { calcPayment } from '@/lib/payment';
import { resolveService, quote } from '@/lib/pricing';
import { addDays, utcToZoned, zonedToUtc, type DateStr } from '@/lib/time';

export async function getSalon(slug: string) {
  return db.query.salons.findFirst({ where: eq(s.salons.slug, slug) });
}

/** Каталог для клиента: категории с услугами и доп. опциями, мастера с графиками */
export async function getCatalog(salonId: string) {
  const categories = await db.query.serviceCategories.findMany({
    where: and(eq(s.serviceCategories.salonId, salonId), eq(s.serviceCategories.active, true)),
    orderBy: asc(s.serviceCategories.sortOrder),
    with: {
      services: { where: eq(s.services.active, true), orderBy: asc(s.services.sortOrder), with: { restrictions: true } },
      addons: { where: eq(s.addons.active, true), orderBy: asc(s.addons.sortOrder) },
      staff: true,
    },
  });
  const staff = await db.query.staff.findMany({
    where: and(eq(s.staff.salonId, salonId), eq(s.staff.active, true)),
    orderBy: asc(s.staff.sortOrder),
    with: { schedule: true, categories: true },
  });
  return {
    categories: categories.map((c) => ({
      id: c.id, hall: c.hall, name: c.name, note: c.note, byLength: c.byLength, forKids: c.forKids,
      staffIds: c.staff.map((x) => x.staffId),
      services: c.services.map((v) => ({
        id: v.id, name: v.name, price: v.price, priceMax: v.priceMax, durationMin: v.durationMin, durationLabel: v.durationLabel,
        byLength: v.byLength, ageMin: v.ageMin, ageMax: v.ageMax, pauseAfterMin: v.pauseAfterMin, pauseMin: v.pauseMin, onlyStaffIds: v.restrictions.map((r) => r.staffId),
      })),
      addons: c.addons.map((a) => ({ id: a.id, name: a.name, price: a.price, durationMin: a.durationMin, rule: a.rule })),
    })),
    staff: staff.filter((m) => m.roles.includes('MASTER')).map((m) => ({
      id: m.id, name: m.name, title: m.title, photoUrl: m.photoUrl, isOwner: m.roles.includes('OWNER'),
      scheduleLabel: workDaysLabel(m.schedule ?? null),
      categoryIds: m.categories.map((c) => c.categoryId),
    })),
  };
}

export type Catalog = Awaited<ReturnType<typeof getCatalog>>;

async function loadService(serviceId: string) {
  return db.query.services.findFirst({
    where: eq(s.services.id, serviceId),
    with: { category: { with: { addons: true, staff: true } }, restrictions: true },
  });
}

/** Мастера, которые делают эту услугу */
function eligibleStaffIds(svc: NonNullable<Awaited<ReturnType<typeof loadService>>>) {
  const byCategory = svc.category.staff.map((x) => x.staffId);
  const only = svc.restrictions.map((r) => r.staffId);
  return only.length ? byCategory.filter((id) => only.includes(id)) : byCategory;
}

type Booking = { serviceId: string; length?: HairLength | null; addonIds: string[] };

async function bookingDuration(b: Booking) {
  const svc = await loadService(b.serviceId);
  if (!svc) throw new Error('Услуга не найдена');
  const resolved = resolveService(svc, b.length ?? null);
  if (!resolved) throw new Error('Для этой длины волос услуги нет');
  const addons = svc.category.addons.filter((a) => b.addonIds.includes(a.id));
  return { svc, resolved, addons, durationMin: resolved.durationMin + addons.reduce((x, a) => x + a.durationMin, 0) };
}

async function staffDay(staffIds: string[], date: DateStr, tz: string) {
  const from = zonedToUtc(date, 0, tz);
  const to = zonedToUtc(addDays(date, 1), 0, tz);
  const [members, appts] = await Promise.all([
    db.query.staff.findMany({ where: inArray(s.staff.id, staffIds), with: { schedule: true, exceptions: true }, orderBy: asc(s.staff.sortOrder) }),
    db.select().from(s.appointments).where(and(
      inArray(s.appointments.staffId, staffIds), gte(s.appointments.startsAt, from), lt(s.appointments.startsAt, to),
      ne(s.appointments.status, 'CANCELLED'),
    )),
  ]);
  return members.map((m) => ({
    id: m.id, name: m.name,
    day: workingHours(m.schedule ?? null, m.exceptions.map((e) => ({ ...e, date: String(e.date) })), date),
    busy: appts.filter((a) => a.staffId === m.id).flatMap((a) => busyParts(
      utcToZoned(a.startsAt, tz).minute, utcToZoned(a.endsAt, tz).minute,
      a.pauseStart != null && a.pauseMin ? { after: a.pauseStart, min: a.pauseMin } : null,
    )),
  }));
}

export type DaySlots = { date: DateStr; slots: { minute: number; staffId: string }[] };

/** Свободные окна на день. staffId = 'any' — любой свободный мастер */
export async function getSlots(salonSlug: string, b: Booking & { staffId: string; date: DateStr }): Promise<DaySlots> {
  const salon = await getSalon(salonSlug);
  if (!salon) throw new Error('Салон не найден');
  const { svc, resolved, durationMin } = await bookingDuration(b);
  const eligible = eligibleStaffIds(svc);
  const ids = b.staffId === 'any' ? eligible : eligible.filter((id) => id === b.staffId);
  const now = utcToZoned(new Date(), salon.timezone);
  const lastDate = addDays(now.date, salon.bookingHorizonDays - 1);
  if (b.date < now.date || b.date > lastDate || !ids.length) return { date: b.date, slots: [] };
  const earliest = b.date === now.date ? now.minute + salon.minLeadMinutes : undefined;

  const byMinute = new Map<number, string>();
  for (const m of await staffDay(ids, b.date, salon.timezone)) {
    if (!m.day) continue;
    for (const t of availableStarts({ day: m.day, durationMin, pause: resolved.pause, busy: m.busy, stepMin: salon.slotStepMinutes, displayStepMin: salon.displayStepMinutes, earliestMin: earliest })) {
      if (!byMinute.has(t)) byMinute.set(t, m.id); // для «любого мастера» — первый свободный по порядку
    }
  }
  return { date: b.date, slots: [...byMinute.entries()].sort((a, z) => a[0] - z[0]).map(([minute, staffId]) => ({ minute, staffId })) };
}

/** Какие дни недели доступны для записи (есть хоть одно окно) */
export async function getWeek(salonSlug: string, b: Booking & { staffId: string; from: DateStr }) {
  const days: { date: DateStr; available: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(b.from, i);
    const { slots } = await getSlots(salonSlug, { ...b, date });
    days.push({ date, available: slots.length > 0 });
  }
  return days;
}

export type CreateInput = Booking & {
  staffId: string; date: DateStr; minute: number;
  client: { name: string; phone: string };
  forChild?: { name: string; birthDate: string } | null;
  usePoints?: boolean; payment?: string | null; source?: 'ONLINE' | 'ADMIN' | 'WALK_IN';
};

/** Создать запись: заново проверяет, что время свободно, и считает цену на сервере */
export async function createAppointment(salonSlug: string, input: CreateInput) {
  const salon = await getSalon(salonSlug);
  if (!salon) throw new Error('Салон не найден');
  const { svc, resolved, addons, durationMin } = await bookingDuration(input);

  return db.transaction(async (tx) => {
    // Блокируем строки мастеров, чтобы две записи одновременно не заняли одно окно
    const eligible = eligibleStaffIds(svc);
    const candidates = input.staffId === 'any' ? eligible : eligible.filter((id) => id === input.staffId);
    if (!candidates.length) throw new Error('Этот мастер не делает эту услугу');
    await tx.select({ id: s.staff.id }).from(s.staff).where(inArray(s.staff.id, candidates)).for('update');

    const isAdmin = input.source === 'ADMIN' || input.source === 'WALK_IN';
    let staffId: string | null = null;
    for (const m of await staffDay(candidates, input.date, salon.timezone)) {
      if (!m.day && !isAdmin) continue;
      const pause = resolved.pause;
      // администратор может записать и вне графика (например, мастер задержится), но не поверх другой записи
      const ok = isAdmin
        ? fits({ start: 0, end: 24 * 60, breaks: [] }, m.busy, input.minute, durationMin, pause)
        : !!m.day && fits(m.day, m.busy, input.minute, durationMin, pause);
      if (ok) {
        staffId = m.id; break;
      }
    }
    if (!staffId) throw new Error('Это время уже занято, выберите другое');

    const phone = input.client.phone.replace(/[^\d+]/g, '');
    let client = phone ? await tx.query.clients.findFirst({ where: and(eq(s.clients.salonId, salon.id), eq(s.clients.phone, phone)) }) : undefined;
    if (!client) [client] = await tx.insert(s.clients).values({ salonId: salon.id, name: input.client.name, phone: phone || null }).returning();
    let visitor = client;
    if (input.forChild) {
      const child = await tx.query.clients.findFirst({ where: and(eq(s.clients.guardianId, client.id), eq(s.clients.name, input.forChild.name)) });
      visitor = child ?? (await tx.insert(s.clients).values({ salonId: salon.id, name: input.forChild.name, birthDate: input.forChild.birthDate, guardianId: client.id }).returning())[0];
    }

    // «Снятие нашей работы бесплатно»: была ли у клиента раньше услуга этой категории
    const past = await tx.select({ id: s.appointments.id }).from(s.appointments)
      .innerJoin(s.services, eq(s.services.id, s.appointments.serviceId))
      .where(and(eq(s.appointments.clientId, visitor.id), eq(s.services.categoryId, svc.categoryId), lt(s.appointments.startsAt, new Date()), ne(s.appointments.status, 'CANCELLED')))
      .limit(1);
    // Баллы списываются на кассе, при оплате — при записи только считаем цену
    const q = quote({ service: resolved, addons, repeatEligible: past.length > 0 });

    const startsAt = zonedToUtc(input.date, input.minute, salon.timezone);
    const [appt] = await tx.insert(s.appointments).values({
      salonId: salon.id, staffId, clientId: visitor.id, serviceId: svc.id, hairLength: input.length ?? null,
      startsAt, endsAt: new Date(startsAt.getTime() + q.durationMin * 60000),
      pauseStart: resolved.pause?.after ?? null, pauseMin: resolved.pause?.min ?? null,
      price: q.total, priceMax: q.totalMax, pointsUsed: q.pointsUsed, source: input.source ?? 'ONLINE',
    }).returning();
    for (const a of q.addons) await tx.insert(s.appointmentAddons).values({ appointmentId: appt.id, addonId: a.id, price: a.price });
    return { id: appt.id, staffId, startsAt, quote: q };
  });
}

/** Журнал администратора на день */
export async function getJournal(salonSlug: string, date: DateStr) {
  const salon = await getSalon(salonSlug);
  if (!salon) throw new Error('Салон не найден');
  const staffRows = await db.query.staff.findMany({
    where: and(eq(s.staff.salonId, salon.id), eq(s.staff.active, true)),
    orderBy: asc(s.staff.sortOrder),
    with: { schedule: true, exceptions: true, categories: { with: { category: true } } },
  });
  const masters = staffRows.filter((m) => m.roles.includes('MASTER'));
  const from = zonedToUtc(date, 0, salon.timezone);
  const to = zonedToUtc(addDays(date, 1), 0, salon.timezone);
  const appts = await db.query.appointments.findMany({
    where: and(eq(s.appointments.salonId, salon.id), gte(s.appointments.startsAt, from), lt(s.appointments.startsAt, to), ne(s.appointments.status, 'CANCELLED')),
    with: { client: { with: { guardian: true } }, service: { with: { category: true } }, addons: { with: { addon: true } } },
    orderBy: asc(s.appointments.startsAt),
  });
  return {
    salon,
    columns: masters.map((m) => {
      const cats = m.categories.map((c) => c.category.name);
      const group = cats.some((n) => /стриж|окраш|уклад|Борода|Детск|Детям/i.test(n)) ? 'hair'
        : cats.some((n) => /Маник|Педик|Наращ/i.test(n)) ? 'nails' : 'brows';
      return {
        id: m.id, name: m.name, photoUrl: m.photoUrl, group,
        masterPercent: m.roles.includes('OWNER') ? 0 : (m.commission ?? salon.defaultCommission),
        scheduleLabel: workDaysLabel(m.schedule ?? null),
        day: workingHours(m.schedule ?? null, m.exceptions.map((e) => ({ ...e, date: String(e.date) })), date),
        items: appts.filter((a) => a.staffId === m.id).map((a) => ({
          id: a.id, start: utcToZoned(a.startsAt, salon.timezone).minute, end: utcToZoned(a.endsAt, salon.timezone).minute,
          client: a.client.name, service: a.service.name, category: a.service.category.name,
          addons: a.addons.map((x) => x.addon.name), price: a.price, priceMax: a.priceMax,
          status: a.status, source: a.source, paid: a.paid,
          pause: a.pauseStart != null && a.pauseMin ? { after: a.pauseStart, min: a.pauseMin } : null,
          phone: (a.client.guardian ?? a.client).phone,
          /** Баллы копятся на счёте взрослого: у ребёнка — на счёте родителя */
          balance: (a.client.guardian ?? a.client).points,
          payer: (a.client.guardian ?? a.client).name,
          payment: a.paid ? {
            finalPrice: a.finalPrice ?? a.price, pointsUsed: a.pointsUsed, cash: a.cashPaid ?? 0, pointsEarned: a.pointsEarned,
            method: a.paymentMethod, masterShare: a.masterShare ?? 0,
          } : null,
        })),
      };
    }),
  };
}

export const PAYMENT_METHODS = { CASH: 'Наличные', CARD: 'Карта', QR: 'QR / банк', POINTS: 'Только баллы' } as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

/** Оплата на кассе: списание баллов, начисление % от денежной части, доля мастера */
export async function payAppointment(salonSlug: string, input: { appointmentId: string; price: number; points: number; method: PaymentMethod }) {
  const salon = await getSalon(salonSlug);
  if (!salon) throw new Error('Салон не найден');
  return db.transaction(async (tx) => {
    const [appt] = await tx.select().from(s.appointments)
      .where(and(eq(s.appointments.id, input.appointmentId), eq(s.appointments.salonId, salon.id))).for('update');
    if (!appt) throw new Error('Запись не найдена');
    if (appt.paid) throw new Error('Эта запись уже оплачена');
    const visitor = await tx.query.clients.findFirst({ where: eq(s.clients.id, appt.clientId) });
    const payerId = visitor?.guardianId ?? appt.clientId;
    const [payer] = await tx.select().from(s.clients).where(eq(s.clients.id, payerId)).for('update');
    const master = await tx.query.staff.findFirst({ where: eq(s.staff.id, appt.staffId) });
    const masterPercent = master?.roles.includes('OWNER') ? 0 : (master?.commission ?? salon.defaultCommission);

    const p = calcPayment({ price: input.price, points: input.points, balance: payer.points, earnPercent: salon.pointsPercent, masterPercent });
    if (p.cash === 0 && input.method !== 'POINTS') input.method = 'POINTS';
    if (p.cash > 0 && input.method === 'POINTS') throw new Error('Выберите, как оплачен остаток');

    await tx.update(s.appointments).set({
      paid: true, status: 'DONE', paidAt: new Date(), paymentMethod: input.method,
      finalPrice: p.price, pointsUsed: p.pointsUsed, cashPaid: p.cash, pointsEarned: p.pointsEarned,
      masterPercent: p.masterPercent, masterShare: p.masterShare,
    }).where(eq(s.appointments.id, appt.id));
    await tx.update(s.clients).set({ points: p.balanceAfter }).where(eq(s.clients.id, payer.id));
    let bal = payer.points;
    if (p.pointsUsed) {
      bal -= p.pointsUsed;
      await tx.insert(s.pointsLedger).values({ salonId: salon.id, clientId: payer.id, appointmentId: appt.id, kind: 'REDEEM', delta: -p.pointsUsed, balanceAfter: bal });
    }
    if (p.pointsEarned) {
      bal += p.pointsEarned;
      await tx.insert(s.pointsLedger).values({ salonId: salon.id, clientId: payer.id, appointmentId: appt.id, kind: 'EARN', delta: p.pointsEarned, balanceAfter: bal });
    }
    return p;
  });
}

/** Отменить ошибочную оплату: вернуть списанные баллы и забрать начисленные */
export async function cancelPayment(salonSlug: string, appointmentId: string) {
  const salon = await getSalon(salonSlug);
  if (!salon) throw new Error('Салон не найден');
  return db.transaction(async (tx) => {
    const [appt] = await tx.select().from(s.appointments)
      .where(and(eq(s.appointments.id, appointmentId), eq(s.appointments.salonId, salon.id))).for('update');
    if (!appt?.paid) throw new Error('Запись не оплачена');
    const visitor = await tx.query.clients.findFirst({ where: eq(s.clients.id, appt.clientId) });
    const [payer] = await tx.select().from(s.clients).where(eq(s.clients.id, visitor?.guardianId ?? appt.clientId)).for('update');
    const balance = payer.points + appt.pointsUsed - appt.pointsEarned;
    if (balance < 0) throw new Error('Начисленные за этот визит баллы уже потрачены — отменить оплату нельзя');
    await tx.update(s.clients).set({ points: balance }).where(eq(s.clients.id, payer.id));
    await tx.insert(s.pointsLedger).values({
      salonId: salon.id, clientId: payer.id, appointmentId: appt.id, kind: 'ADJUST',
      delta: appt.pointsUsed - appt.pointsEarned, balanceAfter: balance, note: 'Отмена оплаты',
    });
    await tx.update(s.appointments).set({
      paid: false, status: 'BOOKED', paidAt: null, paymentMethod: null, finalPrice: null,
      pointsUsed: 0, cashPaid: null, pointsEarned: 0, masterPercent: null, masterShare: null,
    }).where(eq(s.appointments.id, appt.id));
  });
}

/** Касса за день: что получено деньгами, сколько списано баллами и сколько причитается каждому мастеру */
export async function getCashReport(salonSlug: string, date: DateStr) {
  const salon = await getSalon(salonSlug);
  if (!salon) throw new Error('Салон не найден');
  const from = zonedToUtc(date, 0, salon.timezone);
  const to = zonedToUtc(addDays(date, 1), 0, salon.timezone);
  const rows = await db.query.appointments.findMany({
    where: and(eq(s.appointments.salonId, salon.id), eq(s.appointments.paid, true), gte(s.appointments.startsAt, from), lt(s.appointments.startsAt, to)),
    with: { staff: true },
  });
  const byMaster = new Map<string, { name: string; isOwner: boolean; visits: number; price: number; points: number; cash: number; master: number; salon: number }>();
  const methods: Record<string, number> = {};
  for (const r of rows) {
    const m = byMaster.get(r.staffId) ?? { name: r.staff.name, isOwner: r.staff.roles.includes('OWNER'), visits: 0, price: 0, points: 0, cash: 0, master: 0, salon: 0 };
    const cash = r.cashPaid ?? 0;
    m.visits += 1; m.price += r.finalPrice ?? r.price; m.points += r.pointsUsed; m.cash += cash;
    m.master += r.masterShare ?? 0; m.salon += cash - (r.masterShare ?? 0);
    byMaster.set(r.staffId, m);
    if (cash) methods[r.paymentMethod ?? 'CASH'] = (methods[r.paymentMethod ?? 'CASH'] ?? 0) + cash;
  }
  const masters = [...byMaster.values()].sort((a, b) => b.cash - a.cash);
  const sum = (k: 'visits' | 'price' | 'points' | 'cash' | 'master' | 'salon') => masters.reduce((n, m) => n + m[k], 0);
  return {
    masters,
    total: { visits: sum('visits'), price: sum('price'), points: sum('points'), cash: sum('cash'), master: sum('master'), salon: sum('salon') },
    methods: Object.entries(methods).map(([k, v]) => ({ method: PAYMENT_METHODS[k as PaymentMethod] ?? k, amount: v })),
  };
}
