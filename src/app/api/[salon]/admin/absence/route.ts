import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { clearAbsence, setAbsence, setExtraDay } from '@/server/absence';
import { isAdmin } from '@/server/admin-auth';

const D = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Body = z.object({
  staffId: z.string().min(1), from: D, to: D, kind: z.enum(['OFF', 'HOURS', 'EXTRA']),
  start: z.number().int().min(0).max(1440).optional(), end: z.number().int().min(0).max(1440).optional(),
  note: z.string().max(200).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Проверьте даты и время' }, { status: 400 });
  try {
    const { salon } = await ctx.params;
    const b = parsed.data;
    if (b.kind === 'EXTRA') {
      if (b.start == null || b.end == null) return NextResponse.json({ error: 'Укажите часы работы' }, { status: 400 });
      await setExtraDay(salon, { staffId: b.staffId, date: b.from, start: b.start, end: b.end, note: b.note });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(await setAbsence(salon, { ...b, kind: b.kind }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const staffId = req.nextUrl.searchParams.get('staffId') ?? '';
  const date = req.nextUrl.searchParams.get('date') ?? '';
  if (!staffId || !D.safeParse(date).success) return NextResponse.json({ error: 'Не указан мастер или дата' }, { status: 400 });
  try {
    await clearAbsence((await ctx.params).salon, staffId, date);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
