import 'server-only';
import { and, desc, eq, gte, inArray, lt, ne, type SQL } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { addDays, zonedToUtc, type DateStr } from '@/lib/time';
import { getSalon } from './salon';
import { sendToClients, signId } from './push';

// Рассылки салона: важное о работе («нет света, сегодня не работаем») и поздравления/акции.
// Уходят push-уведомлением тем клиентам, у кого включены уведомления. От поздравлений и акций можно отписаться.

export type Audience =
  | { type: 'ALL' }
  | { type: 'DATE'; date: DateStr }
  | { type: 'WOMEN' }
  | { type: 'MEN' }
  | { type: 'MASTER'; staffId: string };

export type BroadcastKind = 'SERVICE' | 'PROMO';

async function recipients(salonId: string, tz: string, audience: Audience, kind: BroadcastKind): Promise<string[]> {
  const subs = await db.selectDistinct({ c: s.pushSubscriptions.clientId }).from(s.pushSubscriptions).where(eq(s.pushSubscriptions.salonId, salonId));
  let ids = subs.map((r) => r.c);
  if (!ids.length) return [];
  const payerOfVisits = async (where: SQL | undefined) => {
    const rows = await db.select({ c: s.appointments.clientId, g: s.clients.guardianId }).from(s.appointments)
      .innerJoin(s.clients, eq(s.clients.id, s.appointments.clientId)).where(where);
    return new Set(rows.map((r) => r.g ?? r.c));
  };
  if (audience.type === 'DATE') {
    const set = await payerOfVisits(and(eq(s.appointments.salonId, salonId), ne(s.appointments.status, 'CANCELLED'),
      gte(s.appointments.startsAt, zonedToUtc(audience.date, 0, tz)), lt(s.appointments.startsAt, zonedToUtc(addDays(audience.date, 1), 0, tz))));
    ids = ids.filter((id) => set.has(id));
  } else if (audience.type === 'MASTER') {
    const set = await payerOfVisits(and(eq(s.appointments.salonId, salonId), eq(s.appointments.staffId, audience.staffId), ne(s.appointments.status, 'CANCELLED')));
    ids = ids.filter((id) => set.has(id));
  }
  if (!ids.length) return [];
  const clients = await db.select().from(s.clients).where(inArray(s.clients.id, ids));
  return clients.filter((c) =>
    (audience.type !== 'WOMEN' || c.gender === 'F') && (audience.type !== 'MEN' || c.gender === 'M') && (kind === 'SERVICE' || !c.promoOptOut),
  ).map((c) => c.id);
}

export async function countRecipients(slug: string, audience: Audience, kind: BroadcastKind) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  return (await recipients(salon.id, salon.timezone, audience, kind)).length;
}

export function audienceLabel(a: Audience, masterName?: string) {
  switch (a.type) {
    case 'ALL': return 'всем клиентам';
    case 'DATE': return `записанным на ${a.date.split('-').reverse().join('.')}`;
    case 'WOMEN': return 'женщинам';
    case 'MEN': return 'мужчинам';
    case 'MASTER': return `клиентам мастера ${masterName ?? ''}`.trim();
  }
}

export async function sendBroadcast(slug: string, input: { title: string; body: string; kind: BroadcastKind; audience: Audience }) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  const ids = await recipients(salon.id, salon.timezone, input.audience, input.kind);
  let delivered = 0;
  if (input.kind === 'SERVICE') {
    delivered = await sendToClients(ids, { title: input.title, body: input.body, url: `/${slug}`, tag: 'salon-news' });
  } else {
    // в поздравлениях и акциях у каждого своя ссылка «отписаться»
    for (const id of ids) {
      delivered += await sendToClients([id], { title: input.title, body: input.body, url: `/${slug}/unsub?c=${id}&t=${await signId(`unsub:${id}`)}`, tag: 'salon-promo' });
    }
  }
  const master = input.audience.type === 'MASTER' ? await db.query.staff.findFirst({ where: eq(s.staff.id, input.audience.staffId) }) : null;
  await db.insert(s.broadcasts).values({
    salonId: salon.id, title: input.title, body: input.body, kind: input.kind,
    audience: audienceLabel(input.audience, master?.name), recipients: ids.length, delivered,
  });
  return { recipients: ids.length, delivered };
}

export async function recentBroadcasts(salonId: string) {
  return db.select().from(s.broadcasts).where(eq(s.broadcasts.salonId, salonId)).orderBy(desc(s.broadcasts.createdAt)).limit(20);
}

/** Сколько клиентов вообще включили уведомления */
export async function pushStats(salonId: string) {
  const rows = await db.selectDistinct({ c: s.pushSubscriptions.clientId }).from(s.pushSubscriptions).where(eq(s.pushSubscriptions.salonId, salonId));
  return { clients: rows.length };
}
