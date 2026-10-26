import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { claimByVisit, forgetClient } from '@/server/me';

type Ctx = { params: Promise<{ salon: string }> };

/** Запомнить клиента на этом телефоне по подписанной ссылке на его запись */
export async function POST(req: NextRequest, ctx: Ctx) {
  const parsed = z.object({ appointmentId: z.string().min(1), token: z.string().min(10) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Проверьте данные' }, { status: 400 });
  const { salon } = await ctx.params;
  try {
    await claimByVisit(salon, parsed.data.appointmentId, parsed.data.token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}

/** Забыть этот телефон */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { salon } = await ctx.params;
  await forgetClient(salon);
  return NextResponse.json({ ok: true });
}
