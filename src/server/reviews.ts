import 'server-only';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { checkId, payerOf } from './push';
import { getSalon } from './salon';

// Оценки мастеров: после оплаченного визита клиент ставит 1–5 звёзд и, по желанию, пишет пару слов.
// Рейтинг виден клиентам, только если хозяйка включила его для мастера и набралось не меньше 10 оценок.
// Низкие оценки (1–3) видит только салон — чтобы успеть исправить ситуацию.
// После 5 звёзд клиенту предлагается оставить отзыв в 2ГИС; баллы за него начисляет администратор, проверив отзыв.

export const MIN_RATINGS = 10;

async function visitByToken(id: string, token: string) {
  if (!(await checkId(id, token))) throw new Error('Ссылка недействительна');
  const a = await db.query.appointments.findFirst({ where: eq(s.appointments.id, id), with: { salon: true, staff: true } });
  if (!a) throw new Error('Запись не найдена');
  return a;
}

export async function getReview(appointmentId: string) {
  return db.query.reviews.findFirst({ where: eq(s.reviews.appointmentId, appointmentId) });
}

export async function submitReview(id: string, token: string, stars: number, text: string | null) {
  const a = await visitByToken(id, token);
  if (!a.paid) throw new Error('Оценить можно после визита');
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Error('Поставьте от 1 до 5 звёзд');
  const [r] = await db.insert(s.reviews).values({ salonId: a.salonId, appointmentId: a.id, staffId: a.staffId, clientId: a.clientId, stars, text: text?.trim() || null })
    .onConflictDoNothing().returning();
  if (!r) throw new Error('Вы уже оценили этот визит — спасибо!');
  return { stars };
}

export async function markGisClick(id: string, token: string) {
  await visitByToken(id, token);
  await db.update(s.reviews).set({ gisClickedAt: new Date() }).where(and(eq(s.reviews.appointmentId, id), eq(s.reviews.stars, 5)));
}

/** Средняя оценка и число оценок по мастерам салона */
export async function staffRatings(salonId: string) {
  const rows = await db.select({ staffId: s.reviews.staffId, avg: sql<number>`avg(${s.reviews.stars})`.mapWith(Number), n: sql<number>`count(*)`.mapWith(Number) })
    .from(s.reviews).where(eq(s.reviews.salonId, salonId)).groupBy(s.reviews.staffId);
  return new Map(rows.map((r) => [r.staffId, { avg: Math.round(r.avg * 10) / 10, count: r.n }]));
}

/** Все оценки салона для администратора (новые сверху) */
export async function listReviews(slug: string) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  const rows = await db.query.reviews.findMany({
    where: eq(s.reviews.salonId, salon.id), orderBy: desc(s.reviews.createdAt), limit: 200,
    with: { staff: true, client: true, appointment: { with: { service: true } } },
  });
  return { salon, rows };
}

/** Администратор проверил отзыв в 2ГИС (5 звёзд) и благодарит баллами — один раз за визит */
export async function rewardGisReview(slug: string, reviewId: string) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  if (salon.reviewBonus <= 0) throw new Error('Баллы за отзыв выключены в настройках');
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(s.reviews).where(and(eq(s.reviews.id, reviewId), eq(s.reviews.salonId, salon.id))).for('update');
    if (!r) throw new Error('Оценка не найдена');
    if (r.gisRewardedAt) throw new Error('Баллы за этот отзыв уже начислены');
    const payerId = await payerOf(r.clientId);
    const [payer] = await tx.select().from(s.clients).where(eq(s.clients.id, payerId)).for('update');
    const balance = payer.points + salon.reviewBonus;
    await tx.update(s.clients).set({ points: balance }).where(eq(s.clients.id, payer.id));
    await tx.insert(s.pointsLedger).values({ salonId: salon.id, clientId: payer.id, appointmentId: r.appointmentId, kind: 'ADJUST', delta: salon.reviewBonus, balanceAfter: balance, note: 'Спасибо за отзыв в 2ГИС' });
    await tx.update(s.reviews).set({ gisRewardedAt: new Date() }).where(eq(s.reviews.id, r.id));
    return { bonus: salon.reviewBonus };
  });
}

/** Есть ли оценки у этих визитов (для «Мои записи») */
export async function reviewedIds(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const rows = await db.select({ id: s.reviews.appointmentId }).from(s.reviews).where(inArray(s.reviews.appointmentId, ids));
  return new Set(rows.map((r) => r.id));
}
