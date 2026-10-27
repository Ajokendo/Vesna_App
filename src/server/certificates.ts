import 'server-only';
import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { db, schema as s } from '@/db';
import { getSalon } from './salon';

// Подарочные сертификаты на любые услуги салона. Хозяйка или администратор включает их в «Настройках»
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

export type CertStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
type Cert = typeof s.certificates.$inferSelect;

export function certStatus(c: Cert, now = new Date()): CertStatus {
  if (c.cancelledAt) return 'CANCELLED';
  if (c.balance <= 0) return 'USED';
  if (c.expiresAt < now) return 'EXPIRED';
  return 'ACTIVE';
}

export const CERT_STATUS: Record<CertStatus, string> = { ACTIVE: 'Действует', USED: 'Использован', EXPIRED: 'Срок истёк', CANCELLED: 'Аннулирован' };

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
      soldMethod: input.method, expiresAt,
    }).returning();
    return c;
  }
  throw new Error('Не получилось создать код — попробуйте ещё раз');
}

/** Сертификаты салона: новые сверху; поиск по коду, имени или телефону */
export async function listCertificates(slug: string) {
  const salon = await salonOf(slug);
  const rows = await db.query.certificates.findMany({ where: eq(s.certificates.salonId, salon.id), orderBy: desc(s.certificates.soldAt), limit: 300 });
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
  return rows.filter((r) => !r.cancelledAt);
}

/** Есть ли у салона действующие сертификаты (тогда в окне оплаты показываем поле, даже если раздел выключен) */
export async function hasActiveCertificates(salonId: string) {
  const c = await db.query.certificates.findFirst({
    where: and(eq(s.certificates.salonId, salonId), gte(s.certificates.balance, 1), gte(s.certificates.expiresAt, new Date()), isNull(s.certificates.cancelledAt)),
    columns: { id: true },
  });
  return !!c;
}
