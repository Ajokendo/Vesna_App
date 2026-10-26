import 'server-only';
import { cookies } from 'next/headers';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db, schema as s } from '@/db';

// Вход мастеров в свой кабинет: мастер выбирает себя и вводит PIN.
// PIN хранится только как хеш; после 5 неверных попыток вход блокируется на 15 минут.
// Сессия — подписанная cookie; при смене PIN старые входы перестают работать.

const COOKIE = 'salon_master';
const MAX_FAILS = 5;
const LOCK_MIN = 15;

const secret = () => process.env.SESSION_SECRET ?? `salon:${process.env.ADMIN_PIN ?? 'dev'}`;

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pin, salt, 32).toString('hex')}`;
}

function checkPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const a = scryptSync(pin, salt, 32);
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

const sign = (staffId: string, pinHash: string) =>
  createHmac('sha256', secret()).update(`${staffId}:${pinHash}`).digest('hex');

export function validPin(pin: string) {
  return /^\d{4,6}$/.test(pin);
}

export async function signInMaster(salonId: string, staffId: string, pin: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await db.query.staff.findFirst({ where: and(eq(s.staff.id, staffId), eq(s.staff.salonId, salonId), eq(s.staff.active, true)) });
  if (!m || !m.roles.includes('MASTER')) return { ok: false, error: 'Мастер не найден' };
  if (!m.pinHash) return { ok: false, error: 'PIN ещё не выдан — попросите администратора' };
  if (m.pinLockedUntil && m.pinLockedUntil > new Date()) {
    const left = Math.ceil((m.pinLockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, error: `Слишком много попыток. Попробуйте через ${left} мин.` };
  }
  if (!checkPin(pin.trim(), m.pinHash)) {
    const fails = m.pinFailed + 1;
    await db.update(s.staff).set(fails >= MAX_FAILS
      ? { pinFailed: 0, pinLockedUntil: new Date(Date.now() + LOCK_MIN * 60000) }
      : { pinFailed: fails }).where(eq(s.staff.id, m.id));
    return { ok: false, error: fails >= MAX_FAILS ? `Неверный PIN. Вход заблокирован на ${LOCK_MIN} мин.` : 'Неверный PIN' };
  }
  await db.update(s.staff).set({ pinFailed: 0, pinLockedUntil: null }).where(eq(s.staff.id, m.id));
  const jar = await cookies();
  jar.set(COOKIE, `${m.id}.${sign(m.id, m.pinHash)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 60,
  });
  return { ok: true };
}

/** Мастер текущего входа или null */
export async function currentMaster(salonId: string) {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const [id, sig] = raw.split('.');
  if (!id || !sig) return null;
  const m = await db.query.staff.findFirst({ where: and(eq(s.staff.id, id), eq(s.staff.salonId, salonId), eq(s.staff.active, true)) });
  if (!m?.pinHash) return null;
  const expected = sign(m.id, m.pinHash);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  return m;
}

export async function signOutMaster() {
  (await cookies()).delete(COOKIE);
}

/** Администратор задаёт или меняет PIN мастера */
export async function setMasterPin(salonId: string, staffId: string, pin: string) {
  if (!validPin(pin)) throw new Error('PIN — от 4 до 6 цифр');
  const m = await db.query.staff.findFirst({ where: and(eq(s.staff.id, staffId), eq(s.staff.salonId, salonId)) });
  if (!m) throw new Error('Мастер не найден');
  await db.update(s.staff).set({ pinHash: hashPin(pin), pinFailed: 0, pinLockedUntil: null }).where(eq(s.staff.id, m.id));
}
