import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { checkId, payerOf } from '@/server/push';
import { notifySoon } from '@/server/notify';
import { getMe } from '@/server/me';

const Body = z.object({
  /** По записи (ссылка с подписью) — или без неё, если телефон уже знает клиента (лист ожидания) */
  appointmentId: z.string().min(1).optional(),
  token: z.string().min(1).optional(),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  }),
});

/** Телефон клиента разрешил уведомления — запоминаем его за клиентом этой записи */
export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Не удалось включить уведомления' }, { status: 400 });
  const { appointmentId, token, subscription } = parsed.data;
  if (!appointmentId || !token) {
    // без записи: клиент, которого этот телефон уже знает
    const me = await getMe((await ctx.params).salon);
    if (!me) return NextResponse.json({ error: 'Сначала запишитесь или встаньте в лист ожидания' }, { status: 403 });
    const clientId = me.client.guardianId ?? me.client.id;
    const v = { salonId: me.salon.id, clientId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent: req.headers.get('user-agent')?.slice(0, 200) ?? null };
    await db.insert(s.pushSubscriptions).values(v)
      .onConflictDoUpdate({ target: s.pushSubscriptions.endpoint, set: { clientId, p256dh: v.p256dh, auth: v.auth, salonId: v.salonId } });
    return NextResponse.json({ ok: true, delivered: 0 });
  }
  if (!(await checkId(appointmentId, token))) return NextResponse.json({ error: 'Ссылка устарела' }, { status: 403 });
  const appt = await db.query.appointments.findFirst({ where: eq(s.appointments.id, appointmentId) });
  if (!appt) return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });
  const clientId = await payerOf(appt.clientId);
  const values = {
    salonId: appt.salonId, clientId, endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
  };
  await db.insert(s.pushSubscriptions).values(values)
    .onConflictDoUpdate({ target: s.pushSubscriptions.endpoint, set: { clientId, p256dh: values.p256dh, auth: values.auth, salonId: values.salonId } });
  const delivered = await notifySoon(appointmentId, 'BOOKED');
  return NextResponse.json({ ok: true, delivered });
}
