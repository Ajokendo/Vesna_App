import 'server-only';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { checkId, signId } from './push';
import { hashPin, matchPin, validPin } from './master-auth';
import { isAdmin } from './admin-auth';

// Вход хозяйки в кабинет с отчётами (выручка, зарплаты мастерам, расходы и прибыль).
// Свой PIN и своя cookie — PIN администратора туда не пускает.
// Первый раз PIN хозяйки задаётся из уже открытого кабинета администратора; потом сменить его можно,
// только зная текущий PIN хозяйки (если забыла — сбрасывает разработчик).

const MAX_FAILS = 5;
const LOCK_MIN = 15;
const cookieName = (slug: string) => `own_${slug}`;
const fingerprint = (salonId: string, pinHash: string) => `owner:${salonId}:${pinHash.slice(-16)}`;
const COOKIE = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 };

async function salonBySlug(slug: string) {
  return db.query.salons.findFirst({ where: eq(s.salons.slug, slug) });
}

export async function isOwner(slug: string): Promise<boolean> {
  const salon = await salonBySlug(slug);
  if (!salon?.ownerPinHash) return false;
  const raw = (await cookies()).get(cookieName(slug))?.value;
  return !!raw && checkId(fingerprint(salon.id, salon.ownerPinHash), raw);
}

/** PIN хозяйки ещё не задан */
export async function ownerPinMissing(slug: string) {
  const salon = await salonBySlug(slug);
  return !!salon && !salon.ownerPinHash;
}

export async function signInOwner(slug: string, pin: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const salon = await salonBySlug(slug);
  if (!salon?.ownerPinHash) return { ok: false, error: 'PIN хозяйки ещё не задан' };
  if (salon.ownerPinLockedUntil && salon.ownerPinLockedUntil > new Date()) {
    const left = Math.ceil((salon.ownerPinLockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, error: `Слишком много попыток. Попробуйте через ${left} мин.` };
  }
  if (!matchPin(pin.trim(), salon.ownerPinHash)) {
    const fails = salon.ownerPinFailed + 1;
    await db.update(s.salons).set(fails >= MAX_FAILS
      ? { ownerPinFailed: 0, ownerPinLockedUntil: new Date(Date.now() + LOCK_MIN * 60000) }
      : { ownerPinFailed: fails }).where(eq(s.salons.id, salon.id));
    return { ok: false, error: fails >= MAX_FAILS ? `Неверный PIN. Вход заблокирован на ${LOCK_MIN} мин.` : 'Неверный PIN' };
  }
  await db.update(s.salons).set({ ownerPinFailed: 0, ownerPinLockedUntil: null }).where(eq(s.salons.id, salon.id));
  (await cookies()).set(cookieName(slug), await signId(fingerprint(salon.id, salon.ownerPinHash)), COOKIE);
  return { ok: true };
}

/**
 * Задать PIN хозяйки. Первый раз — из открытого кабинета администратора; дальше — только из кабинета хозяйки.
 * PIN хозяйки не может совпадать с PIN администратора.
 */
export async function setOwnerPin(slug: string, pin: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const salon = await salonBySlug(slug);
  if (!salon) return { ok: false, error: 'Салон не найден' };
  const allowed = salon.ownerPinHash ? await isOwner(slug) : await isAdmin(slug);
  if (!allowed) return { ok: false, error: salon.ownerPinHash ? 'Войдите как хозяйка' : 'Сначала войдите как администратор' };
  if (!validPin(pin)) return { ok: false, error: 'PIN — от 4 до 6 цифр' };
  if (salon.adminPinHash && matchPin(pin, salon.adminPinHash)) return { ok: false, error: 'PIN хозяйки должен отличаться от PIN администратора' };
  const hash = hashPin(pin);
  await db.update(s.salons).set({ ownerPinHash: hash, ownerPinFailed: 0, ownerPinLockedUntil: null }).where(eq(s.salons.id, salon.id));
  (await cookies()).set(cookieName(slug), await signId(fingerprint(salon.id, hash)), COOKIE);
  return { ok: true };
}

export async function signOutOwner(slug: string) {
  (await cookies()).delete(cookieName(slug));
}
