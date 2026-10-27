import 'server-only';
import { and, asc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema as s } from '@/db';
import { getSalon, PAYMENT_METHODS, type PaymentMethod } from './salon';
import { staffRatings } from './reviews';
import { makePeriod, previousPeriod, type Period, type PeriodKind } from '@/lib/period';
import { utcToZoned, zonedToUtc } from '@/lib/time';

// Отчёты для хозяйки: выручка за период, зарплата мастерам, мастера и услуги, расходы и прибыль.
// Выручка = деньги, полученные за визиты (без баллов: баллы — скидка). Доля мастера — с той же суммы.
// Прибыль = выручка − доли мастеров − расходы. Работа хозяйки-мастера целиком идёт салону.

export const EXPENSE_CATEGORIES = ['Аренда', 'Материалы и краска', 'Свет, вода, интернет', 'Зарплата администратора', 'Реклама', 'Хозяйственные', 'Другое'] as const;

async function salonOf(slug: string) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  return salon;
}

type Salon = NonNullable<Awaited<ReturnType<typeof getSalon>>>;

async function paidIn(salon: Salon, p: Period) {
  return db.query.appointments.findMany({
    where: and(eq(s.appointments.salonId, salon.id), eq(s.appointments.paid, true),
      gte(s.appointments.startsAt, zonedToUtc(p.from, 0, salon.timezone)), lt(s.appointments.startsAt, zonedToUtc(p.to, 0, salon.timezone))),
    with: { staff: true, service: { with: { category: true } } },
    orderBy: asc(s.appointments.startsAt),
  });
}

type Row = Awaited<ReturnType<typeof paidIn>>[number];

/** Доля мастера с визита; у старых записей без сохранённой доли — по проценту мастера */
function shareOf(r: Row, defaultCommission: number) {
  if (r.masterShare != null) return r.masterShare;
  const pct = r.masterPercent ?? (r.staff.roles.includes('OWNER') ? 0 : (r.staff.commission ?? defaultCommission));
  return Math.round(((r.cashPaid ?? 0) * pct) / 100);
}

function totals(rows: Row[], defaultCommission: number) {
  const cash = rows.reduce((n, r) => n + (r.cashPaid ?? 0), 0);
  const master = rows.reduce((n, r) => n + shareOf(r, defaultCommission), 0);
  return {
    visits: rows.length, cash, master, salon: cash - master,
    price: rows.reduce((n, r) => n + (r.finalPrice ?? r.price), 0),
    points: rows.reduce((n, r) => n + r.pointsUsed, 0),
    avgCheck: rows.length ? Math.round(cash / rows.length) : 0,
  };
}

async function expensesIn(salonId: string, p: Period) {
  return db.query.expenses.findMany({
    where: and(eq(s.expenses.salonId, salonId), gte(s.expenses.date, p.from), lt(s.expenses.date, p.to)),
    orderBy: [asc(s.expenses.date), asc(s.expenses.createdAt)],
  });
}

/** Все отчёты за период (страницы кабинета берут из него своё) */
export async function ownerReport(slug: string, kind: PeriodKind, at: string) {
  const salon = await salonOf(slug);
  const p = makePeriod(kind, at);
  const pp = previousPeriod(p);
  const [rows, prevRows, costs, prevCosts] = await Promise.all([paidIn(salon, p), paidIn(salon, pp), expensesIn(salon.id, p), expensesIn(salon.id, pp)]);
  const fromUtc = zonedToUtc(p.from, 0, salon.timezone);
  const toUtc = zonedToUtc(p.to, 0, salon.timezone);
  const t = totals(rows, salon.defaultCommission);
  const tp = totals(prevRows, salon.defaultCommission);

  // по способам оплаты
  const methods: Record<string, number> = {};
  for (const r of rows) if (r.cashPaid) methods[r.paymentMethod ?? 'CASH'] = (methods[r.paymentMethod ?? 'CASH'] ?? 0) + r.cashPaid;

  // график
  const series = p.buckets.map((b) => {
    const a = zonedToUtc(b.from, 0, salon.timezone); const z = zonedToUtc(b.to, 0, salon.timezone);
    const inB = rows.filter((r) => r.startsAt >= a && r.startsAt < z);
    return { label: b.label, from: b.from, cash: inB.reduce((n, r) => n + (r.cashPaid ?? 0), 0), visits: inB.length };
  });

  // новые и постоянные клиенты: новый — первый оплаченный визит в салоне попал в этот период
  const clientIds = [...new Set(rows.map((r) => r.clientId))];
  let newClients = 0;
  if (clientIds.length) {
    const firsts = await db.select({ clientId: s.appointments.clientId, first: sql<Date>`min(${s.appointments.startsAt})` })
      .from(s.appointments).where(and(eq(s.appointments.salonId, salon.id), eq(s.appointments.paid, true), inArray(s.appointments.clientId, clientIds)))
      .groupBy(s.appointments.clientId);
    newClients = firsts.filter((f) => new Date(f.first) >= fromUtc).length;
  }

  // неявки и отмены за период
  const lost = await db.select({ staffId: s.appointments.staffId, status: s.appointments.status, n: sql<number>`count(*)::int` })
    .from(s.appointments).where(and(eq(s.appointments.salonId, salon.id), inArray(s.appointments.status, ['NO_SHOW', 'CANCELLED']),
      gte(s.appointments.startsAt, fromUtc), lt(s.appointments.startsAt, toUtc)))
    .groupBy(s.appointments.staffId, s.appointments.status);
  const noShows = lost.filter((l) => l.status === 'NO_SHOW').reduce((n, l) => n + l.n, 0);
  const cancelled = lost.filter((l) => l.status === 'CANCELLED').reduce((n, l) => n + l.n, 0);

  // по мастерам (зарплата и статистика)
  const staffList = await db.query.staff.findMany({ where: eq(s.staff.salonId, salon.id), orderBy: [asc(s.staff.sortOrder), asc(s.staff.name)] });
  const ratings = await staffRatings(salon.id).catch(() => new Map<string, { avg: number; count: number }>());
  const masters = staffList.filter((m) => m.roles.includes('MASTER') && (m.active || rows.some((r) => r.staffId === m.id))).map((m) => {
    const mine = rows.filter((r) => r.staffId === m.id);
    const mt = totals(mine, salon.defaultCommission);
    const isOwner = m.roles.includes('OWNER');
    return {
      id: m.id, name: m.name, isOwner, active: m.active,
      percent: isOwner ? 0 : (m.commission ?? salon.defaultCommission),
      ...mt,
      noShows: lost.filter((l) => l.staffId === m.id && l.status === 'NO_SHOW').reduce((n, l) => n + l.n, 0),
      rating: (ratings as Map<string, { avg: number; count: number }>).get(m.id) ?? null,
      /** визиты по дням — для ведомости */
      lines: mine.map((r) => ({
        date: utcToZoned(r.startsAt, salon.timezone).date, service: r.service.name, price: r.finalPrice ?? r.price,
        points: r.pointsUsed, cash: r.cashPaid ?? 0, share: shareOf(r, salon.defaultCommission),
      })),
    };
  });

  // услуги
  const svc = new Map<string, { name: string; category: string; count: number; cash: number }>();
  for (const r of rows) {
    const k = r.serviceId;
    const v = svc.get(k) ?? { name: r.service.name, category: r.service.category?.name ?? '', count: 0, cash: 0 };
    v.count += 1; v.cash += r.cashPaid ?? 0;
    svc.set(k, v);
  }
  const services = [...svc.values()].sort((a, b) => b.cash - a.cash);

  // расходы и прибыль
  const costTotal = costs.reduce((n, c) => n + c.amount, 0);
  const prevCostTotal = prevCosts.reduce((n, c) => n + c.amount, 0);
  const byCategory = EXPENSE_CATEGORIES.map((c) => ({ category: c as string, amount: costs.filter((x) => x.category === c).reduce((n, x) => n + x.amount, 0) }))
    .concat([...new Set(costs.map((c) => c.category))].filter((c) => !(EXPENSE_CATEGORIES as readonly string[]).includes(c))
      .map((c) => ({ category: c, amount: costs.filter((x) => x.category === c).reduce((n, x) => n + x.amount, 0) })))
    .filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);

  return {
    salon, period: p, prevPeriod: pp,
    revenue: { ...t, methods: Object.entries(methods).map(([k, v]) => ({ method: PAYMENT_METHODS[k as PaymentMethod] ?? k, amount: v })).sort((a, b) => b.amount - a.amount), series, newClients, returning: clientIds.length - newClients, clients: clientIds.length, noShows, cancelled },
    prev: tp,
    masters, services,
    costs: { items: costs, total: costTotal, byCategory, prevTotal: prevCostTotal },
    profit: t.salon - costTotal,
    prevProfit: tp.salon - prevCostTotal,
  };
}

export type OwnerReport = Awaited<ReturnType<typeof ownerReport>>;

export const ExpenseInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().trim().min(1).max(40),
  amount: z.number().int().min(1).max(100_000_000),
  note: z.string().trim().max(120).nullable(),
});

export async function addExpense(slug: string, data: z.infer<typeof ExpenseInput>) {
  const salon = await salonOf(slug);
  await db.insert(s.expenses).values({ salonId: salon.id, ...data, note: data.note || null });
}

export async function deleteExpense(slug: string, id: string) {
  const salon = await salonOf(slug);
  await db.delete(s.expenses).where(and(eq(s.expenses.id, id), eq(s.expenses.salonId, salon.id)));
}
