import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { cancelPayment, payAppointment } from '@/server/salon';
import { isAdmin } from '@/server/admin-auth';

const Pay = z.object({
  appointmentId: z.string().min(1),
  price: z.number().int().min(0),
  points: z.number().int().min(0).default(0),
  method: z.enum(['CASH', 'CARD', 'QR', 'POINTS']),
});

async function guard() {
  return (await isAdmin()) ? null : NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  const denied = await guard(); if (denied) return denied;
  const parsed = Pay.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Проверьте данные оплаты' }, { status: 400 });
  try {
    return NextResponse.json(await payAppointment((await ctx.params).salon, parsed.data));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  const denied = await guard(); if (denied) return denied;
  const id = req.nextUrl.searchParams.get('appointmentId');
  if (!id) return NextResponse.json({ error: 'Не указана запись' }, { status: 400 });
  try {
    await cancelPayment((await ctx.params).salon, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
