import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { markGisClick, submitReview } from '@/server/reviews';

/** Клиент оценивает визит по ссылке из уведомления: { t, stars, text } или { t, gis: true } — перешёл оставить отзыв в 2ГИС */
export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string; id: string }> }) {
  const parsed = z.union([
    z.object({ t: z.string().min(10), stars: z.number().int().min(1).max(5), text: z.string().max(1000).nullable().optional() }),
    z.object({ t: z.string().min(10), gis: z.literal(true) }),
  ]).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Поставьте оценку' }, { status: 400 });
  const { id } = await ctx.params;
  try {
    if ('gis' in parsed.data) { await markGisClick(id, parsed.data.t); return NextResponse.json({ ok: true }); }
    return NextResponse.json(await submitReview(id, parsed.data.t, parsed.data.stars, parsed.data.text ?? null));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
