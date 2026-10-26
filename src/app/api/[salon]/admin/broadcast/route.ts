import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { countRecipients, sendBroadcast, type Audience } from '@/server/broadcast';
import { isAdmin } from '@/server/admin-auth';

const AudienceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ALL') }),
  z.object({ type: z.literal('DATE'), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ type: z.literal('WOMEN') }),
  z.object({ type: z.literal('MEN') }),
  z.object({ type: z.literal('MASTER'), staffId: z.string().min(1) }),
]);
const Kind = z.enum(['SERVICE', 'PROMO']);

/** Сколько клиентов получат рассылку */
export async function GET(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  if (!(await isAdmin((await ctx.params).salon))) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const a = AudienceSchema.safeParse({ type: q.get('type'), date: q.get('date') ?? undefined, staffId: q.get('staffId') ?? undefined });
  const k = Kind.safeParse(q.get('kind'));
  if (!a.success || !k.success) return NextResponse.json({ count: 0 });
  return NextResponse.json({ count: await countRecipients((await ctx.params).salon, a.data as Audience, k.data) });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  if (!(await isAdmin((await ctx.params).salon))) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const parsed = z.object({
    title: z.string().trim().min(2).max(60), body: z.string().trim().min(2).max(300), kind: Kind, audience: AudienceSchema,
  }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Заполните заголовок (до 60 знаков) и текст (до 300)' }, { status: 400 });
  try {
    return NextResponse.json(await sendBroadcast((await ctx.params).salon, { ...parsed.data, audience: parsed.data.audience as Audience }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
