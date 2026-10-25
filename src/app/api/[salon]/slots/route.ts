import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSlots, getWeek } from '@/server/salon';

const Query = z.object({
  serviceId: z.string().min(1),
  staffId: z.string().min(1),
  length: z.enum(['SHORT', 'MEDIUM', 'LONG', 'XLONG']).optional(),
  addons: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  const { salon } = await ctx.params;
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 });
  const q = parsed.data;
  const base = { serviceId: q.serviceId, staffId: q.staffId, length: q.length ?? null, addonIds: q.addons ? q.addons.split(',') : [] };
  try {
    if (q.week) return NextResponse.json({ days: await getWeek(salon, { ...base, from: q.week }) });
    if (q.date) return NextResponse.json(await getSlots(salon, { ...base, date: q.date }));
    return NextResponse.json({ error: 'Нужна дата' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
