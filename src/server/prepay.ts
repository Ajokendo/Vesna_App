import 'server-only';
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { getSalon } from './salon';
import { notifySoon } from './notify';
import { checkWaitlistFor } from './waitlist';

// Предоплата для тех, кто не приходил. Клиенту с N неявками (настройка салона) онлайн-запись ставится «ждёт предоплату»:
// он видит сумму и реквизиты, переводит, администратор отмечает «Предоплата получена». Если за отведённые минуты
// предоплату не отметили — запись отменяется сама и время освобождается. Администратор может для клиента
// включить предоплату всегда или, наоборот, отменить её («простить»).

type Salon = { id: string; prepayEnabled: boolean; prepayAfterNoShows: number };

/** Сколько раз клиент (и записанные им дети) не пришёл */
export async function noShowCount(clientId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(s.appointments)
    .innerJoin(s.clients, eq(s.clients.id, s.appointments.clientId))
    .where(and(eq(s.appointments.status, 'NO_SHOW'), or(eq(s.clients.id, clientId), eq(s.clients.guardianId, clientId))));
  return r?.n ?? 0;
}

/** Нужна ли этому клиенту предоплата при онлайн-записи */
export async function needsPrepay(salon: Salon, payerId: string) {
  if (!salon.prepayEnabled) return false;
  const c = await db.query.clients.findFirst({ where: eq(s.clients.id, payerId), columns: { prepay: true } });
  if (c?.prepay === 'ALWAYS') return true;
  if (c?.prepay === 'NEVER') return false;
  return (await noShowCount(payerId)) >= Math.max(1, salon.prepayAfterNoShows);
}

/** Администратор: предоплата получена (сумма — по записи, если не указана) */
export async function markPrepaid(slug: string, appointmentId: string, amount?: number) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  const a = await db.query.appointments.findFirst({ where: and(eq(s.appointments.id, appointmentId), eq(s.appointments.salonId, salon.id)) });
  if (!a) throw new Error('Запись не найдена');
  if (a.status === 'CANCELLED') throw new Error('Запись уже отменена — создайте новую');
  const sum = amount ?? a.prepayAmount ?? 0;
  await db.update(s.appointments).set({ prepaidAt: new Date(), prepaid: sum }).where(eq(s.appointments.id, a.id));
}

/** Администратор: всегда просить предоплату / не просить / по числу неявок */
export async function setClientPrepay(slug: string, clientId: string, mode: 'ALWAYS' | 'NEVER' | null) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  await db.update(s.clients).set({ prepay: mode }).where(and(eq(s.clients.id, clientId), eq(s.clients.salonId, salon.id)));
}

/** Отменить записи, по которым предоплату не получили вовремя. Безопасно вызывать часто */
export async function expirePrepayments() {
  const rows = await db.select().from(s.appointments).where(and(
    lt(s.appointments.prepayDue, new Date()), isNull(s.appointments.prepaidAt), eq(s.appointments.paid, false),
    inArray(s.appointments.status, ['BOOKED', 'CONFIRMED']),
  ));
  for (const a of rows) {
    await db.update(s.appointments).set({ status: 'CANCELLED', cancelledBy: 'PREPAY' }).where(eq(s.appointments.id, a.id));
    await notifySoon(a.id, 'CANCELLED').catch(() => {});
    await checkWaitlistFor(a).catch(() => 0);
  }
  return rows.length;
}
