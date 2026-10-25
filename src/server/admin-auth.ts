import 'server-only';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';

// Временный вход для персонала по PIN-коду (переменная ADMIN_PIN).
// В следующем этапе заменим на вход сотрудников по телефону с ролями.

const COOKIE = 'salon_admin';
const token = (pin: string) => createHash('sha256').update(`salon-admin:${pin}`).digest('hex');

export async function isAdmin(): Promise<boolean> {
  const pin = process.env.ADMIN_PIN;
  if (!pin) return false;
  const jar = await cookies();
  return jar.get(COOKIE)?.value === token(pin);
}

export async function signInWithPin(pin: string): Promise<boolean> {
  const expected = process.env.ADMIN_PIN;
  if (!expected || pin.trim() !== expected) return false;
  const jar = await cookies();
  jar.set(COOKIE, token(expected), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return true;
}
