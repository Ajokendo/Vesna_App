import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAdmin } from '@/server/admin-auth';
import { markPrepaid, setClientPrepay } from '@/server/prepay';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('paid'), id: z.string().min(1), amount: z.number().int().min(0).optional() }),
  z.object({ action: z.literal('client'), clientId: z.string().min(1), mode: z.enum(['ALWAYS', 'NEVER']).nullable() }),
]);

/** Предоплата: отметить полученной; для клиента — всегда просить / не просить / по неявкам */
export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  const { salon } = await ctx.params;
  if (!(await isAdmin(salon))) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Проверьте данные' }, { status: 400 });
  try {
    const b = parsed.data;
    if (b.action === 'paid') await markPrepaid(salon, b.id, b.amount);
    else await setClientPrepay(salon, b.clientId, b.mode);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
