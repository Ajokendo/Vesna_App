import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { checkId } from '@/server/push';
import { clientReportsLate } from '@/server/absence';

/** Клиент предупреждает: опоздаю на N минут */
export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string; id: string }> }) {
  const { id } = await ctx.params;
  if (!(await checkId(id, req.nextUrl.searchParams.get('t') ?? ''))) return NextResponse.json({ error: 'Ссылка устарела' }, { status: 403 });
  const parsed = z.object({ minutes: z.number().int().min(5).max(60) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Укажите, на сколько опоздаете' }, { status: 400 });
  try {
    await clientReportsLate(id, parsed.data.minutes);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
