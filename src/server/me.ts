import 'server-only';
import { cookies } from 'next/headers';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { utcToZoned } from '@/lib/time';
import { checkId, payerOf, signId } from './push';
import { getSalon } from './salon';
import { ensureReferralCode } from './referral';
import { reviewedIds } from './reviews';

// «Это мой телефон»: после записи (или открытия ссылки из уведомления) телефон запоминает клиента —
// в подписанной cookie, без паролей и SMS. По ней клиент видит свои записи и баллы.

const cookieName = (slug: string) => `me_${slug}`;
const YEAR = 365 * 24 * 3600;

export async function rememberClient(slug: string, clientId: string) {
  const payer = await payerOf(clientId);
  const jar = await cookies();
  jar.set(cookieName(slug), `${payer}.${await signId(`me:${payer}`)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: YEAR, path: '/',
  });
}

export async function forgetClient(slug: string) {
  (await cookies()).delete(cookieName(slug));
}

/** Клиент, которого запомнил этот телефон (взрослый — владелец счёта баллов), или null */
export async function getMe(slug: string) {
  const raw = (await cookies()).get(cookieName(slug))?.value;
  if (!raw) return null;
  const [id, sig] = raw.split('.');
  if (!id || !sig || !(await checkId(`me:${id}`, sig))) return null;
  const salon = await getSalon(slug);
  if (!salon) return null;
  const c = await db.query.clients.findFirst({ where: and(eq(s.clients.id, id), eq(s.clients.salonId, salon.id)), with: { family: true } });
  return c ? { salon, client: c } : null;
}

const lengthName: Record<string, string> = { SHORT: 'короткие', MEDIUM: 'средние', LONG: 'длинные', XLONG: 'очень длинные' };

/** Записи клиента и его детей: предстоящие (со ссылкой на страницу записи) и прошлые */
export async function myVisits(slug: string) {
  const me = await getMe(slug);
  if (!me) return null;
  const ids = [me.client.id, ...me.client.family.map((k) => k.id)];
  const appts = await db.query.appointments.findMany({
    where: inArray(s.appointments.clientId, ids),
    with: { staff: true, client: true, service: { with: { category: true } } },
    orderBy: desc(s.appointments.startsAt),
    limit: 60,
  });
  const tz = me.salon.timezone;
  const soon = Date.now() - 2 * 3600_000;
  const rows = await Promise.all(appts.map(async (a) => {
    const z = utcToZoned(a.startsAt, tz);
    return {
      id: a.id, token: await signId(a.id), date: z.date, start: z.minute, end: utcToZoned(a.endsAt, tz).minute,
      staff: a.staff.name, staffPhoto: a.staff.photoUrl,
      service: a.service.name + (a.hairLength ? ` (${lengthName[a.hairLength]})` : ''),
      forWhom: a.client.guardianId ? a.client.name : null,
      price: a.paid ? (a.finalPrice ?? a.price) : a.price, priceMax: a.paid ? null : a.priceMax,
      paid: a.paid, status: a.status, confirmed: !!a.confirmedAt,
      upcoming: !a.paid && a.startsAt.getTime() > soon && a.status !== 'CANCELLED' && a.status !== 'NO_SHOW',
      canRate: false,
    };
  }));
  const reviewed = await reviewedIds(rows.filter((r) => r.paid).map((r) => r.id));
  for (const r of rows) r.canRate = r.paid && !reviewed.has(r.id);
  return { me: { name: me.client.name, phone: me.client.phone, welcomeGot: !!me.client.welcomeBonusAt }, upcoming: rows.filter((r) => r.upcoming).reverse(), past: rows.filter((r) => !r.upcoming) };
}

/** Баллы: остаток, процент и история начислений/списаний */
export async function myPoints(slug: string) {
  const me = await getMe(slug);
  if (!me) return null;
  const ledger = await db.select({
    id: s.pointsLedger.id, kind: s.pointsLedger.kind, delta: s.pointsLedger.delta, balanceAfter: s.pointsLedger.balanceAfter,
    note: s.pointsLedger.note, createdAt: s.pointsLedger.createdAt, service: s.services.name,
  }).from(s.pointsLedger)
    .leftJoin(s.appointments, eq(s.appointments.id, s.pointsLedger.appointmentId))
    .leftJoin(s.services, eq(s.services.id, s.appointments.serviceId))
    .where(and(eq(s.pointsLedger.clientId, me.client.id), eq(s.pointsLedger.salonId, me.salon.id)))
    .orderBy(desc(s.pointsLedger.createdAt)).limit(100);
  return {
    id: me.client.id, name: me.client.name, birthDate: me.client.birthDate, balance: me.client.points, percent: me.salon.pointsPercent,
    minRedeem: me.salon.minRedeem, welcomeBonus: me.salon.welcomeBonus, welcomeGot: !!me.client.welcomeBonusAt,
    referralBonus: me.salon.referralBonus,
    referralCode: me.salon.referralBonus > 0 ? await ensureReferralCode(me.salon.id, me.client.id) : null,
    invited: (await db.query.clients.findMany({ where: eq(s.clients.referredById, me.client.id), columns: { name: true, referralRewardedAt: true } }))
      .map((f) => ({ name: f.name, came: !!f.referralRewardedAt })),
    history: ledger.map((l) => ({ ...l, date: utcToZoned(l.createdAt, me.salon.timezone).date })),
  };
}

/** Ссылка из уведомления подтверждает, что это телефон клиента: запоминаем его */
export async function claimByVisit(slug: string, appointmentId: string, token: string) {
  if (!(await checkId(appointmentId, token))) throw new Error('Ссылка недействительна');
  const a = await db.query.appointments.findFirst({ where: eq(s.appointments.id, appointmentId), with: { salon: true } });
  if (!a || a.salon.slug !== slug) throw new Error('Запись не найдена');
  await rememberClient(slug, a.clientId);
}

/** Подписанный «ключ» клиента — тот же, что в cookie. Нужен iPhone: у приложения на экране «Домой» свои cookie */
export async function meToken(clientId: string) {
  return `${clientId}.${await signId(`me:${clientId}`)}`;
}

/** Установленное приложение открылось с ключом клиента в адресе — запоминаем его уже внутри приложения */
export async function claimByToken(slug: string, token: string) {
  const [id, sig] = token.split('.');
  if (!id || !sig || !(await checkId(`me:${id}`, sig))) throw new Error('Ссылка недействительна');
  const salon = await getSalon(slug);
  const c = salon && await db.query.clients.findFirst({ where: and(eq(s.clients.id, id), eq(s.clients.salonId, salon.id)) });
  if (!c) throw new Error('Клиент не найден');
  await rememberClient(slug, c.id);
}

/**
 * Подарок за установку приложения: один раз на клиента, когда приложение впервые открыто
 * с экрана телефона (как установленное), а телефон уже знает клиента.
 */
export async function grantWelcomeBonus(slug: string) {
  const me = await getMe(slug);
  if (!me) return { granted: 0, reason: 'unknown' as const };
  const bonus = me.salon.welcomeBonus;
  if (bonus <= 0) return { granted: 0, reason: 'off' as const };
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(s.clients).where(eq(s.clients.id, me.client.id)).for('update');
    if (!c || c.welcomeBonusAt) return { granted: 0, reason: 'already' as const };
    const balance = c.points + bonus;
    await tx.update(s.clients).set({ points: balance, welcomeBonusAt: new Date() }).where(eq(s.clients.id, c.id));
    await tx.insert(s.pointsLedger).values({ salonId: me.salon.id, clientId: c.id, kind: 'ADJUST', delta: bonus, balanceAfter: balance, note: 'Подарок за установку приложения' });
    return { granted: bonus, balance, reason: 'ok' as const };
  });
}
