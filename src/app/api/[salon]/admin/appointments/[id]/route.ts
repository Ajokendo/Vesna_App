import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { cancelAppointment, reassignAppointment } from '@/server/absence';
import { isAdmin } from '@/server/admin-auth';

type Ctx = { params: Promise<{ salon: string; id: string }> };

/** Передать запись другому мастеру */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const parsed = z.object({ staffId: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Выберите мастера' }, { status: 400 });
  const { salon, id } = await ctx.params;
  try {
    return NextResponse.json(await reassignAppointment(salon, id, parsed.data.staffId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}

/** Отменить запись */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const { salon, id } = await ctx.params;
  try {
    await cancelAppointment(salon, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
