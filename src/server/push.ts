import 'server-only';
import webpush from 'web-push';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { db, schema as s } from '@/db';

// Push-уведомления (Web Push). Ключи и секрет ссылок создаются сами при первом запуске и хранятся в базе —
// ничего настраивать на сервере не нужно.

async function setting(key: string, make: () => string): Promise<string> {
  const row = await db.query.appSettings.findFirst({ where: eq(s.appSettings.key, key) });
  if (row) return row.value;
  await db.insert(s.appSettings).values({ key, value: make() }).onConflictDoNothing();
  return (await db.query.appSettings.findFirst({ where: eq(s.appSettings.key, key) }))!.value;
}

let vapidReady: Promise<{ publicKey: string; privateKey: string }> | null = null;
export function vapidKeys() {
  vapidReady ??= (async () => {
    const raw = await setting('vapid', () => JSON.stringify(webpush.generateVAPIDKeys()));
    const keys = JSON.parse(raw) as { publicKey: string; privateKey: string };
    webpush.setVapidDetails('mailto:noreply@vesna-app.vercel.app', keys.publicKey, keys.privateKey);
    return keys;
  })().catch((e) => { vapidReady = null; throw e; });
  return vapidReady;
}

const linkSecret = () => setting('link_secret', () => randomBytes(32).toString('hex'));

/** Подпись ссылки на запись: клиент может подтвердить или включить уведомления только по своей записи */
export async function signId(id: string) {
  return createHmac('sha256', await linkSecret()).update(id).digest('base64url').slice(0, 22);
}
export async function checkId(id: string, token: string) {
  const expected = await signId(id);
  return expected.length === token.length && timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export type PushPayload = {
  title: string;
  body: string;
  /** Куда открыть при нажатии */
  url: string;
  /** Кнопка «Подтвердить» в уведомлении: адрес, на который отправить подтверждение */
  confirmUrl?: string;
  tag?: string;
};

/** Отправить уведомление на все телефоны клиентов; возвращает, на сколько телефонов доставлено */
export async function sendToClients(clientIds: string[], payload: PushPayload): Promise<number> {
  if (!clientIds.length) return 0;
  const subs = await db.select().from(s.pushSubscriptions).where(inArray(s.pushSubscriptions.clientId, [...new Set(clientIds)]));
  if (!subs.length) return 0;
  await vapidKeys();
  let ok = 0;
  const body = JSON.stringify(payload);
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, { TTL: 60 * 60 * 12 });
      ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // телефон отписался или приложение удалено — убираем подписку
      if (code === 404 || code === 410) await db.delete(s.pushSubscriptions).where(eq(s.pushSubscriptions.id, sub.id));
      else console.error('push error', code, (e as Error).message);
    }
  }
  return ok;
}

/** Взрослый, которому приходят уведомления: для ребёнка — родитель */
export async function payerOf(clientId: string) {
  const c = await db.query.clients.findFirst({ where: eq(s.clients.id, clientId) });
  return c?.guardianId ?? clientId;
}
