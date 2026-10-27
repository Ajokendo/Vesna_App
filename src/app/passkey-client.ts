'use client';

import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from '@simplewebauthn/browser';

// Отпечаток / Face ID на стороне телефона. Телефон помнит, для какой роли включён вход (ключ в localStorage):
// без этого кнопка «Войти по отпечатку» не показывается. Сам секретный ключ хранит телефон, не мы.

export type Role = 'ADMIN' | 'OWNER' | 'MASTER' | 'CLIENT';
type Saved = { id: string; sub: string | null };

const key = (slug: string, role: Role) => `pk:${slug}:${role}`;

export function saved(slug: string, role: Role): Saved[] {
  try { return JSON.parse(localStorage.getItem(key(slug, role)) ?? '[]') as Saved[]; } catch { return []; }
}
function store(slug: string, role: Role, list: Saved[]) {
  try { if (list.length) localStorage.setItem(key(slug, role), JSON.stringify(list)); else localStorage.removeItem(key(slug, role)); } catch { /* приватный режим */ }
}

/** Есть ли на телефоне Face ID / отпечаток / код разблокировки */
export async function supported() {
  try { return browserSupportsWebAuthn() && await platformAuthenticatorIsAvailable(); } catch { return false; }
}

async function call(slug: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/${slug}/passkey`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error ?? 'Не получилось');
  return d;
}

/** Понятная ошибка вместо технической («пользователь отменил» и т. п.) */
export function humanError(e: unknown) {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') return 'Отменено. Попробуйте ещё раз или войдите по PIN.';
  if (name === 'InvalidStateError') return 'На этом телефоне вход уже включён.';
  return (e as Error)?.message || 'Не получилось';
}

export async function enable(slug: string, role: Role) {
  const optionsJSON = await call(slug, { action: 'reg-options', role });
  const response = await startRegistration({ optionsJSON });
  const d = await call(slug, { action: 'reg-verify', role, response, device: navigator.userAgent });
  store(slug, role, [...saved(slug, role).filter((x) => x.sub !== d.subjectId), { id: d.credentialId, sub: d.subjectId }]);
}

/** Выключить. sub не указан — все ключи этой роли на телефоне */
export async function disable(slug: string, role: Role, sub?: string | null) {
  const list = saved(slug, role);
  const hit = (x: Saved) => sub === undefined || x.sub === sub;
  for (const x of list.filter(hit)) await call(slug, { action: 'remove', role, credentialId: x.id }).catch(() => {});
  store(slug, role, list.filter((x) => !hit(x)));
}

/** Войти (или разблокировать) по отпечатку / Face ID. sub — для мастера: кто именно */
export async function login(slug: string, role: Role, sub?: string | null) {
  const ids = saved(slug, role).filter((x) => sub === undefined || x.sub === sub).map((x) => x.id);
  const optionsJSON = await call(slug, { action: 'auth-options', role, credentialIds: ids });
  const response = await startAuthentication({ optionsJSON });
  return call(slug, { action: 'auth-verify', role, response }) as Promise<{ ok: true; subjectId: string | null }>;
}
