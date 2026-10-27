import 'server-only';
import { cookies, headers } from 'next/headers';
import { and, eq, inArray } from 'drizzle-orm';
import {
  generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
  type AuthenticationResponseJSON, type AuthenticatorTransportFuture, type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { db, schema as s } from '@/db';
import { getSalon } from './salon';
import { checkId, signId } from './push';
import { isAdmin, startAdminSession } from './admin-auth';
import { isOwner, startOwnerSession } from './owner-auth';
import { currentMaster, startMasterSession } from './master-auth';
import { getMe } from './me';

// Вход по отпечатку пальца / Face ID (passkey, WebAuthn). Включает сам человек, уже войдя обычным способом (PIN,
// для клиента — приложение его узнало). Ключ хранится в телефоне; на сервере — только открытая часть.
// Телефон сам решает, что спросить: Face ID, отпечаток или код разблокировки. PIN всегда остаётся запасным входом.

export type PasskeyRole = 'ADMIN' | 'OWNER' | 'MASTER' | 'CLIENT';
const CH_COOKIE = 'pk_ch';

async function site() {
  const h = await headers();
  const origin = h.get('origin') ?? '';
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(':')[0];
  let rpID = host;
  try { if (origin) rpID = new URL(origin).hostname; } catch { /* оставим host */ }
  if (host && rpID !== host) throw new Error('Неверный адрес');
  return { origin, rpID };
}

/** Кто сейчас вошёл в этой роли (для включения отпечатка) */
async function current(slug: string, role: PasskeyRole) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  if (role === 'ADMIN') return (await isAdmin(slug)) ? { salon, subjectId: null as string | null, label: `Администратор «${salon.name}»` } : null;
  if (role === 'OWNER') return (await isOwner(slug)) ? { salon, subjectId: null, label: `Директор «${salon.name}»` } : null;
  if (role === 'MASTER') { const m = await currentMaster(salon.id); return m ? { salon, subjectId: m.id, label: `${m.name} · «${salon.name}»` } : null; }
  const me = await getMe(slug);
  return me ? { salon, subjectId: me.client.id, label: `${me.client.name} · «${salon.name}»` } : null;
}

async function saveChallenge(challenge: string) {
  (await cookies()).set(CH_COOKIE, `${challenge}.${await signId(`pk:${challenge}`)}`, {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 300,
  });
}
async function takeChallenge() {
  const jar = await cookies();
  const raw = jar.get(CH_COOKIE)?.value ?? '';
  jar.delete(CH_COOKIE);
  const [ch, sig] = raw.split('.');
  if (!ch || !sig || !(await checkId(`pk:${ch}`, sig))) throw new Error('Время ожидания вышло — попробуйте ещё раз');
  return ch;
}

/** Шаг 1 включения: параметры для телефона */
export async function registrationOptions(slug: string, role: PasskeyRole) {
  const who = await current(slug, role);
  if (!who) throw new Error('Сначала войдите обычным способом');
  const { rpID } = await site();
  const existing = await db.query.passkeys.findMany({ where: and(eq(s.passkeys.salonId, who.salon.id), eq(s.passkeys.role, role)) });
  const mine = existing.filter((p) => p.subjectId === who.subjectId);
  const opts = await generateRegistrationOptions({
    rpName: `Салон «${who.salon.name}»`, rpID,
    userName: who.label, userDisplayName: who.label,
    userID: new TextEncoder().encode(`${who.salon.id}:${role}:${who.subjectId ?? ''}`.slice(0, 64)),
    attestationType: 'none',
    excludeCredentials: mine.map((p) => ({ id: p.credentialId, transports: (p.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required', authenticatorAttachment: 'platform' },
  });
  await saveChallenge(opts.challenge);
  return opts;
}

/** Шаг 2 включения: проверить ответ телефона и запомнить ключ */
export async function verifyRegistration(slug: string, role: PasskeyRole, response: RegistrationResponseJSON, device: string | null) {
  const who = await current(slug, role);
  if (!who) throw new Error('Сначала войдите обычным способом');
  const { origin, rpID } = await site();
  const expectedChallenge = await takeChallenge();
  const v = await verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
  if (!v.verified || !v.registrationInfo) throw new Error('Телефон не подтвердил — попробуйте ещё раз');
  const c = v.registrationInfo.credential;
  await db.insert(s.passkeys).values({
    salonId: who.salon.id, role, subjectId: who.subjectId, credentialId: c.id,
    publicKey: Buffer.from(c.publicKey).toString('base64url'), counter: c.counter,
    transports: c.transports ?? null, device: device?.slice(0, 120) ?? null,
  }).onConflictDoNothing();
  return { credentialId: c.id, subjectId: who.subjectId };
}

/** Вход: параметры для телефона (ключи, которые этот телефон помнит для этой роли) */
export async function authenticationOptions(slug: string, role: PasskeyRole, credentialIds: string[]) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  const { rpID } = await site();
  const known = credentialIds.length ? await db.query.passkeys.findMany({
    where: and(eq(s.passkeys.salonId, salon.id), eq(s.passkeys.role, role), inArray(s.passkeys.credentialId, credentialIds.slice(0, 10))),
  }) : [];
  if (!known.length) throw new Error('Вход по отпечатку на этом телефоне выключен — войдите по PIN');
  const opts = await generateAuthenticationOptions({
    rpID, userVerification: 'required',
    allowCredentials: known.map((p) => ({ id: p.credentialId, transports: (p.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined })),
  });
  await saveChallenge(opts.challenge);
  return opts;
}

/** Вход: проверить ответ телефона и открыть сессию (для клиента — просто разблокировать) */
export async function verifyAuthentication(slug: string, role: PasskeyRole, response: AuthenticationResponseJSON) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  const { origin, rpID } = await site();
  const expectedChallenge = await takeChallenge();
  const pk = await db.query.passkeys.findFirst({ where: and(eq(s.passkeys.credentialId, response.id), eq(s.passkeys.salonId, salon.id), eq(s.passkeys.role, role)) });
  if (!pk) throw new Error('Этот ключ не найден — войдите по PIN');
  const v = await verifyAuthenticationResponse({
    response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
    credential: { id: pk.credentialId, publicKey: Buffer.from(pk.publicKey, 'base64url'), counter: pk.counter, transports: (pk.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined },
  });
  if (!v.verified) throw new Error('Не удалось подтвердить — войдите по PIN');
  await db.update(s.passkeys).set({ counter: v.authenticationInfo.newCounter, lastUsedAt: new Date() }).where(eq(s.passkeys.id, pk.id));
  if (role === 'ADMIN') await startAdminSession(slug);
  else if (role === 'OWNER') await startOwnerSession(slug);
  else if (role === 'MASTER') await startMasterSession(salon.id, pk.subjectId!);
  else {
    // клиент: приложение должно узнавать именно этого клиента
    const me = await getMe(slug);
    if (!me || me.client.id !== pk.subjectId) throw new Error('Ключ от другого клиента');
  }
  return { ok: true, subjectId: pk.subjectId };
}

/** Выключить вход по отпечатку на этом телефоне */
export async function removePasskey(slug: string, role: PasskeyRole, credentialId: string) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  const who = await current(slug, role);
  // выключить может тот, кто вошёл в этой роли; для клиента ключ можно убрать и при «Это не мой телефон»
  if (!who && role !== 'CLIENT') throw new Error('Сначала войдите');
  await db.delete(s.passkeys).where(and(eq(s.passkeys.credentialId, credentialId), eq(s.passkeys.salonId, salon.id), eq(s.passkeys.role, role)));
}
