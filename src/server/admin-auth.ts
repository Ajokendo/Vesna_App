import 'server-only';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { checkId, signId } from './push';
import { hashPin, matchPin, validPin } from './master-auth';

// Вход администратора салона по PIN. У каждого салона свой PIN (хранится только хеш) и своя cookie —
// вход в один салон не открывает другой. После 5 неверных попыток вход блокируется на 15 минут.
// Первый салон («Весна») мог работать со старым общим PIN из настроек сервера (ADMIN_PIN):
// при первом входе этим PIN он сохраняется как PIN салона.

const MAX_FAILS = 5;
const LOCK_MIN = 15;
const cookieName = (slug: string) => `adm_${slug}`;

async function salonBySlug(slug: string) {
  return db.query.salons.findFirst({ where: eq(s.salons.slug, slug) });
}

/** «Отпечаток» PIN: при смене PIN все старые входы перестают работать */
const fingerprint = (salonId: string, pinHash: string) => `admin:${salonId}:${pinHash.slice(-16)}`;

export async function isAdmin(slug: string): Promise<boolean> {
  const salon = await salonBySlug(slug);
  if (!salon?.adminPinHash) return false;
  const raw = (await cookies()).get(cookieName(slug))?.value;
  return !!raw && checkId(fingerprint(salon.id, salon.adminPinHash), raw);
}

export async function signInWithPin(slug: string, pin: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const salon = await salonBySlug(slug);
  if (!salon) return { ok: false, error: 'Салон не найден' };
  if (salon.adminPinLockedUntil && salon.adminPinLockedUntil > new Date()) {
    const left = Math.ceil((salon.adminPinLockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, error: `Слишком много попыток. Попробуйте через ${left} мин.` };
  }
  let hash = salon.adminPinHash;
  let ok = false;
  if (hash) ok = matchPin(pin.trim(), hash);
  else if (process.env.ADMIN_PIN && pin.trim() === process.env.ADMIN_PIN) {
    // старый общий PIN — переносим в салон
    hash = hashPin(pin.trim());
    await db.update(s.salons).set({ adminPinHash: hash }).where(eq(s.salons.id, salon.id));
    ok = true;
  }
  if (!ok || !hash) {
    const fails = salon.adminPinFailed + 1;
    await db.update(s.salons).set(fails >= MAX_FAILS
      ? { adminPinFailed: 0, adminPinLockedUntil: new Date(Date.now() + LOCK_MIN * 60000) }
      : { adminPinFailed: fails }).where(eq(s.salons.id, salon.id));
    return { ok: false, error: fails >= MAX_FAILS ? `Неверный PIN. Вход заблокирован на ${LOCK_MIN} мин.` : 'Неверный PIN' };
  }
  await db.update(s.salons).set({ adminPinFailed: 0, adminPinLockedUntil: null }).where(eq(s.salons.id, salon.id));
  (await cookies()).set(cookieName(slug), await signId(fingerprint(salon.id, hash)), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  return { ok: true };
}

/** Сменить PIN администратора (из настроек, уже войдя). Остальные входы администратора завершатся */
export async function setAdminPin(slug: string, pin: string) {
  if (!validPin(pin)) throw new Error('PIN — от 4 до 6 цифр');
  const salon = await salonBySlug(slug);
  if (!salon) throw new Error('Салон не найден');
  const hash = hashPin(pin);
  await db.update(s.salons).set({ adminPinHash: hash, adminPinFailed: 0, adminPinLockedUntil: null }).where(eq(s.salons.id, salon.id));
  (await cookies()).set(cookieName(slug), await signId(fingerprint(salon.id, hash)), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
}

export async function signOutAdmin(slug: string) {
  (await cookies()).delete(cookieName(slug));
}

/** Нужна ли салону первичная настройка (PIN администратора ещё не задан, есть код настройки) */
export async function needsSetup(slug: string) {
  const salon = await salonBySlug(slug);
  return !!salon && !salon.adminPinHash && !!salon.setupCodeHash;
}

/** Первичная настройка нового салона: код от разработчика + новый PIN администратора */
export async function completeSetup(slug: string, code: string, pin: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const salon = await salonBySlug(slug);
  if (!salon?.setupCodeHash || salon.adminPinHash) return { ok: false, error: 'Салон уже настроен — войдите по PIN' };
  if (salon.adminPinLockedUntil && salon.adminPinLockedUntil > new Date()) return { ok: false, error: 'Слишком много попыток. Попробуйте позже.' };
  if (!matchPin(code.trim().toUpperCase(), salon.setupCodeHash)) {
    const fails = salon.adminPinFailed + 1;
    await db.update(s.salons).set(fails >= MAX_FAILS
      ? { adminPinFailed: 0, adminPinLockedUntil: new Date(Date.now() + LOCK_MIN * 60000) } : { adminPinFailed: fails }).where(eq(s.salons.id, salon.id));
    return { ok: false, error: 'Неверный код настройки' };
  }
  if (!validPin(pin)) return { ok: false, error: 'PIN — от 4 до 6 цифр' };
  await setAdminPin(slug, pin);
  await db.update(s.salons).set({ setupCodeHash: null }).where(eq(s.salons.id, salon.id));
  return { ok: true };
}
