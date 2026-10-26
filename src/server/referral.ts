import 'server-only';
import { cookies } from 'next/headers';
import { and, count, eq, gte, ne } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db, schema as s } from '@/db';
import { sendToClients } from './push';

// «Пригласи друга»: у клиента есть ссылка с кодом (?ref=…). Друг открыл ссылку — телефон друга запоминает код.
// Друг записался впервые — его карточка помечается «пригласил такой-то». Друг оплатил первый визит —
// пригласившему автоматически начисляются баллы (один раз за друга, с лимитом в месяц).

const refCookie = (slug: string) => `ref_${slug}`;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Код приглашения клиента (создаётся при первом обращении) */
export async function ensureReferralCode(salonId: string, clientId: string) {
  const c = await db.query.clients.findFirst({ where: eq(s.clients.id, clientId), columns: { referralCode: true } });
  if (c?.referralCode) return c.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = Array.from(randomBytes(5), (b) => ALPHABET[b % ALPHABET.length]).join('');
    const taken = await db.query.clients.findFirst({ where: and(eq(s.clients.salonId, salonId), eq(s.clients.referralCode, code)), columns: { id: true } });
    if (taken) continue;
    await db.update(s.clients).set({ referralCode: code }).where(eq(s.clients.id, clientId));
    return code;
  }
  throw new Error('Не удалось создать код приглашения');
}

/** Друг открыл ссылку приглашения: запоминаем код на его телефоне (90 дней) */
export async function rememberReferral(slug: string, code: string) {
  const salon = await db.query.salons.findFirst({ where: eq(s.salons.slug, slug) });
  if (!salon || salon.referralBonus <= 0) return false;
  const referrer = await db.query.clients.findFirst({ where: and(eq(s.clients.salonId, salon.id), eq(s.clients.referralCode, code.trim().toUpperCase())) });
  if (!referrer) return false;
  (await cookies()).set(refCookie(slug), referrer.referralCode!, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 90 * 24 * 3600 });
  return true;
}

/** После онлайн-записи: если клиент новый и пришёл по ссылке — отметить, кто его пригласил */
export async function attachReferral(slug: string, clientId: string, isNewClient: boolean) {
  const jar = await cookies();
  const code = jar.get(refCookie(slug))?.value;
  if (!code) return;
  jar.delete(refCookie(slug));
  if (!isNewClient) return;
  const client = await db.query.clients.findFirst({ where: eq(s.clients.id, clientId) });
  if (!client || client.referredById) return;
  const referrer = await db.query.clients.findFirst({ where: and(eq(s.clients.salonId, client.salonId), eq(s.clients.referralCode, code)) });
  if (!referrer || referrer.id === client.id || (referrer.phone && referrer.phone === client.phone)) return;
  await db.update(s.clients).set({ referredById: referrer.id }).where(eq(s.clients.id, client.id));
}

/** Администратор вручную отмечает, кто пригласил клиента (пришёл без записи) — только пока у клиента нет оплаченных визитов */
export async function setReferrerByPhone(salonId: string, clientId: string, phone: string | null) {
  const client = await db.query.clients.findFirst({ where: and(eq(s.clients.id, clientId), eq(s.clients.salonId, salonId)) });
  if (!client) throw new Error('Клиент не найден');
  if (!phone) { if (!client.referralRewardedAt) await db.update(s.clients).set({ referredById: null }).where(eq(s.clients.id, client.id)); return null; }
  if (client.referralRewardedAt) throw new Error('Баллы за этого клиента уже начислены');
  const digits = phone.replace(/\D/g, '');
  const all = await db.query.clients.findMany({ where: and(eq(s.clients.salonId, salonId), ne(s.clients.id, client.id)), columns: { id: true, name: true, phone: true } });
  const referrer = all.find((c) => c.phone && c.phone.replace(/\D/g, '').endsWith(digits.slice(-9)));
  if (!referrer) throw new Error('Клиент с таким телефоном не найден');
  await db.update(s.clients).set({ referredById: referrer.id }).where(eq(s.clients.id, client.id));
  return referrer.name;
}

/** После оплаты: первая оплата приглашённого друга → баллы пригласившему (один раз, с лимитом в месяц) */
export async function rewardReferral(salonId: string, payerId: string) {
  const salon = await db.query.salons.findFirst({ where: eq(s.salons.id, salonId) });
  if (!salon || salon.referralBonus <= 0) return 0;
  return db.transaction(async (tx) => {
    const [friend] = await tx.select().from(s.clients).where(eq(s.clients.id, payerId)).for('update');
    if (!friend?.referredById || friend.referralRewardedAt) return 0;
    const [referrer] = await tx.select().from(s.clients).where(eq(s.clients.id, friend.referredById)).for('update');
    if (!referrer) return 0;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const [{ n }] = await tx.select({ n: count() }).from(s.clients)
      .where(and(eq(s.clients.referredById, referrer.id), gte(s.clients.referralRewardedAt, monthStart)));
    await tx.update(s.clients).set({ referralRewardedAt: new Date() }).where(eq(s.clients.id, friend.id));
    if (n >= salon.referralMonthlyLimit) return 0;
    const balance = referrer.points + salon.referralBonus;
    await tx.update(s.clients).set({ points: balance }).where(eq(s.clients.id, referrer.id));
    await tx.insert(s.pointsLedger).values({ salonId, clientId: referrer.id, kind: 'ADJUST', delta: salon.referralBonus, balanceAfter: balance, note: `Друг ${friend.name} посетил салон` });
    return salon.referralBonus;
  }).then(async (bonus) => {
    if (bonus) {
      const friend = await db.query.clients.findFirst({ where: eq(s.clients.id, payerId) });
      await sendToClients([friend!.referredById!], {
        title: `Вам ${bonus} баллов!`, body: `Ваш друг ${friend!.name} посетил салон «${salon.name}». Спасибо, что рекомендуете нас!`,
        url: `/${salon.slug}/points`, tag: `ref-${payerId}`,
      }).catch(() => 0);
    }
    return bonus;
  });
}

/** Для карточки клиента: кто пригласил и скольких привёл */
export async function referralInfo(clientId: string) {
  const c = await db.query.clients.findFirst({ where: eq(s.clients.id, clientId) });
  const referrer = c?.referredById ? await db.query.clients.findFirst({ where: eq(s.clients.id, c.referredById), columns: { id: true, name: true } }) : null;
  const invited = await db.query.clients.findMany({ where: eq(s.clients.referredById, clientId), columns: { id: true, name: true, referralRewardedAt: true } });
  return { referrer: referrer ?? null, rewarded: !!c?.referralRewardedAt, invited: invited.map((i) => ({ id: i.id, name: i.name, came: !!i.referralRewardedAt })) };
}
