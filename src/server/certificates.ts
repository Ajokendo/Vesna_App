import 'server-only';
import { and, desc, eq, gte, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { db, schema as s } from '@/db';
import { getSalon } from './salon';
import { getMe } from './me';
import { sendToClients } from './push';
import { formatSom } from '@/lib/pricing';

// Подарочные сертификаты на любые услуги салона. Директор или администратор включает их в «Настройках»
// и выпускает сертификат после оплаты; клиент оплачивает им визит целиком или частями, остаток сохраняется.
// Выключение раздела не гасит уже проданные сертификаты — деньги за них получены, их принимают до конца срока.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без 0/O и 1/I — чтобы не путали при вводе

/** Код вида K7QM-4XRA */
function newCode() {
  const c = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

/** Привести введённый код к виду XXXX-XXXX (пробелы, дефисы, строчные буквы, О вместо 0 и т. п.) */
export function normalizeCode(raw: string) {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/0/g, 'O').replace(/1/g, 'I');
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

export type CertStatus = 'PENDING' | 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
type Cert = typeof s.certificates.$inferSelect;

export function certStatus(c: Pick<Cert, 'cancelledAt' | 'paidAt' | 'balance' | 'expiresAt'>, now = new Date()): CertStatus {
  if (c.cancelledAt) return 'CANCELLED';
  if (!c.paidAt) return 'PENDING';
  if (c.balance <= 0) return 'USED';
  if (c.expiresAt < now) return 'EXPIRED';
  return 'ACTIVE';
}

export const CERT_STATUS: Record<CertStatus, string> = { PENDING: 'Ждёт подтверждения оплаты', ACTIVE: 'Действует', USED: 'Использован', EXPIRED: 'Срок истёк', CANCELLED: 'Аннулирован' };

async function salonOf(slug: string) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  return salon;
}

export const CertSettings = z.object({
  enabled: z.boolean(),
  months: z.number().int().min(1).max(36),
});

/** Включить / выключить сертификаты и срок действия новых */
export async function setCertificateSettings(slug: string, data: z.infer<typeof CertSettings>) {
  const salon = await salonOf(slug);
  await db.update(s.salons).set({ certificatesEnabled: data.enabled, certificateMonths: data.months }).where(eq(s.salons.id, salon.id));
}

export const IssueInput = z.object({
  amount: z.number().int().min(100).max(1_000_000),
  toName: z.string().trim().max(60).nullable(),
  fromName: z.string().trim().max(60).nullable(),
  buyerPhone: z.string().trim().max(30).nullable(),
  method: z.enum(['CASH', 'CARD', 'QR']),
});

/** Выпустить сертификат (деньги уже получены) */
export async function issueCertificate(slug: string, input: z.infer<typeof IssueInput>) {
  const salon = await salonOf(slug);
  if (!salon.certificatesEnabled) throw new Error('Сертификаты выключены — включите их в «Настройках»');
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + salon.certificateMonths);
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const exists = await db.query.certificates.findFirst({ where: eq(s.certificates.code, code) });
    if (exists) continue;
    const [c] = await db.insert(s.certificates).values({
      salonId: salon.id, code, amount: input.amount, balance: input.amount,
      toName: input.toName || null, fromName: input.fromName || null, buyerPhone: input.buyerPhone || null,
      soldMethod: input.method, expiresAt, paidAt: new Date(),
    }).returning();
    return c;
  }
  throw new Error('Не получилось создать код — попробуйте ещё раз');
}

/** Сертификаты салона: новые сверху; поиск по коду, имени или телефону */
export async function listCertificates(slug: string) {
  const salon = await salonOf(slug);
  const rows = await db.query.certificates.findMany({ where: eq(s.certificates.salonId, salon.id), columns: { receipt: false }, orderBy: desc(s.certificates.soldAt), limit: 300 });
  return { salon, rows: rows.map((c) => ({ ...c, status: certStatus(c) })) };
}

/** Найти сертификат салона по коду (для оплаты и для страницы сертификата) */
export async function findCertificate(slug: string, code: string) {
  const salon = await salonOf(slug);
  const c = await db.query.certificates.findFirst({ where: and(eq(s.certificates.salonId, salon.id), eq(s.certificates.code, normalizeCode(code))) });
  return c ? { salon, cert: { ...c, status: certStatus(c) } } : { salon, cert: null };
}

/** Аннулировать — только если по сертификату ещё ничего не оплачено (ошибка при выпуске, деньги вернули) */
export async function cancelCertificate(slug: string, id: string) {
  const salon = await salonOf(slug);
  const c = await db.query.certificates.findFirst({ where: and(eq(s.certificates.id, id), eq(s.certificates.salonId, salon.id)) });
  if (!c) throw new Error('Сертификат не найден');
  if (c.balance !== c.amount) throw new Error('По сертификату уже оплачивали услуги — аннулировать нельзя');
  await db.update(s.certificates).set({ cancelledAt: new Date() }).where(eq(s.certificates.id, c.id));
}

/** Продажи сертификатов за период (для кассы) */
export async function certificateSales(salonId: string, from: Date, to: Date) {
  const rows = await db.query.certificates.findMany({
    where: and(eq(s.certificates.salonId, salonId), gte(s.certificates.soldAt, from), lt(s.certificates.soldAt, to)),
    orderBy: desc(s.certificates.soldAt),
  });
  return rows.filter((r) => !r.cancelledAt && r.paidAt);
}

/** Есть ли у салона действующие сертификаты (тогда в окне оплаты показываем поле, даже если раздел выключен) */
export async function hasActiveCertificates(salonId: string) {
  const c = await db.query.certificates.findFirst({
    where: and(eq(s.certificates.salonId, salonId), gte(s.certificates.balance, 1), gte(s.certificates.expiresAt, new Date()), isNull(s.certificates.cancelledAt), isNotNull(s.certificates.paidAt)),
    columns: { id: true },
  });
  return !!c;
}

// ——— Покупка сертификата клиентом в приложении: перевод по реквизитам салона + чек; администратор подтверждает ———

export const BuyInput = z.object({
  amount: z.number().int().min(100).max(1_000_000),
  toName: z.string().trim().max(60).nullable(),
  fromName: z.string().trim().max(60).nullable(),
  recipientPhone: z.string().trim().max(30).nullable(),
  buyer: z.object({ name: z.string().trim().min(2, 'Укажите имя'), phone: z.string().trim().regex(/^\+?\d[\d\s()-]{8,}$/, 'Проверьте номер телефона') }).nullable(),
  receipt: z.string().regex(/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/, 'Прикрепите чек').max(4_000_000, 'Чек слишком большой'),
});

const digits = (p: string | null | undefined) => (p ?? '').replace(/\D/g, '').slice(-9);

/** Клиент купил сертификат: заявка с чеком, ждёт подтверждения администратора. Возвращает id покупателя */
export async function requestCertificate(slug: string, input: z.infer<typeof BuyInput>) {
  const salon = await salonOf(slug);
  if (!salon.certificatesEnabled) throw new Error('Сертификаты сейчас не продаются');
  const me = await getMe(slug);
  let buyer: { id: string; name: string; phone: string | null } | undefined = me?.client;
  if (!buyer) {
    if (!input.buyer) throw new Error('Укажите ваше имя и телефон');
    const phone = input.buyer.phone.replace(/[^\d+]/g, '');
    buyer = await db.query.clients.findFirst({ where: and(eq(s.clients.salonId, salon.id), eq(s.clients.phone, phone)) })
      ?? (await db.insert(s.clients).values({ salonId: salon.id, name: input.buyer.name, phone }).returning())[0];
  }
  const expiresAt = new Date(); expiresAt.setMonth(expiresAt.getMonth() + salon.certificateMonths);
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    if (await db.query.certificates.findFirst({ where: eq(s.certificates.code, code) })) continue;
    await db.insert(s.certificates).values({
      salonId: salon.id, code, amount: input.amount, balance: input.amount,
      toName: input.toName || null, fromName: input.fromName || buyer.name, buyerPhone: buyer.phone,
      soldMethod: 'QR', expiresAt, paidAt: null, buyerClientId: buyer.id,
      recipientPhone: input.recipientPhone || null, receipt: input.receipt,
    });
    return { buyerId: buyer.id };
  }
  throw new Error('Не получилось создать заявку — попробуйте ещё раз');
}


/** Заявки из приложения, ждущие подтверждения оплаты */
export async function pendingCertificates(salonId: string) {
  return db.query.certificates.findMany({
    where: and(eq(s.certificates.salonId, salonId), isNull(s.certificates.paidAt), isNull(s.certificates.cancelledAt)),
    columns: { receipt: false }, orderBy: desc(s.certificates.soldAt),
  });
}

/** Чек заявки — для просмотра администратором */
export async function certificateReceipt(slug: string, id: string) {
  const salon = await salonOf(slug);
  const c = await db.query.certificates.findFirst({ where: and(eq(s.certificates.id, id), eq(s.certificates.salonId, salon.id)), columns: { receipt: true } });
  return c?.receipt ?? null;
}

/** Администратор: оплата получена — сертификат начинает действовать, покупателю и получателю — уведомления */
export async function confirmCertificate(slug: string, id: string) {
  const salon = await salonOf(slug);
  const c = await db.query.certificates.findFirst({ where: and(eq(s.certificates.id, id), eq(s.certificates.salonId, salon.id)) });
  if (!c) throw new Error('Заявка не найдена');
  if (c.paidAt) return;
  const now = new Date();
  const expiresAt = new Date(now); expiresAt.setMonth(expiresAt.getMonth() + salon.certificateMonths);
  // получатель — клиент салона с этим номером (если он уже есть)
  let recipientClientId: string | null = null;
  if (c.recipientPhone) {
    const all = await db.query.clients.findMany({ where: and(eq(s.clients.salonId, salon.id), isNotNull(s.clients.phone)), columns: { id: true, phone: true } });
    recipientClientId = all.find((x) => digits(x.phone) === digits(c.recipientPhone))?.id ?? null;
  }
  await db.update(s.certificates).set({ paidAt: now, soldAt: now, expiresAt, recipientClientId }).where(eq(s.certificates.id, c.id));
  const url = `/${salon.slug}/c/${c.code}`;
  if (c.buyerClientId) {
    await sendToClients([c.buyerClientId], { title: '🎁 Сертификат готов', body: `Оплата получена. Сертификат на ${formatSom(c.amount)} — откройте и перешлите${c.toName ? ` ${c.toName}` : ''}.`, url, tag: `cert-${c.id}` }).catch(() => 0);
  }
  if (recipientClientId && recipientClientId !== c.buyerClientId) {
    await sendToClients([recipientClientId], { title: '🎁 Вам подарили сертификат!', body: `${c.fromName ?? 'Вам'} дарит сертификат салона «${salon.name}» на ${formatSom(c.amount)}. Используйте его при оплате.`, url, tag: `cert-${c.id}` }).catch(() => 0);
  }
}

/** Администратор: отклонить заявку (оплата не пришла или чек неверный) */
export async function rejectCertificate(slug: string, id: string) {
  const salon = await salonOf(slug);
  await db.update(s.certificates).set({ cancelledAt: new Date() })
    .where(and(eq(s.certificates.id, id), eq(s.certificates.salonId, salon.id), isNull(s.certificates.paidAt)));
}

/** Мои сертификаты: купленные мной и подаренные мне (по клиенту или номеру телефона) */
export async function myCertificates(slug: string) {
  const me = await getMe(slug);
  if (!me) return [];
  const ph = digits(me.client.phone);
  const rows = await db.query.certificates.findMany({
    where: and(eq(s.certificates.salonId, me.salon.id), or(eq(s.certificates.buyerClientId, me.client.id), eq(s.certificates.recipientClientId, me.client.id), isNotNull(s.certificates.recipientPhone))),
    columns: { receipt: false }, orderBy: desc(s.certificates.soldAt), limit: 50,
  });
  return rows
    .filter((c) => c.buyerClientId === me.client.id || c.recipientClientId === me.client.id || (ph && digits(c.recipientPhone) === ph && c.paidAt))
    .map((c) => ({ ...c, status: certStatus(c), mine: c.buyerClientId === me.client.id }));
}
