import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { cancelAppointment, markArrived, markNoShow, reassignAppointment, setAppointmentEnd, undoNoShow } from '@/server/absence';
import { isAdmin } from '@/server/admin-auth';

type Ctx = { params: Promise<{ salon: string; id: string }> };

/** Передать запись другому мастеру ({ staffId }) или изменить время окончания ({ endMinute }) */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const parsed = z.union([
    z.object({ staffId: z.string().min(1) }),
    z.object({ endMinute: z.number().int().min(0).max(24 * 60) }),
    z.object({ action: z.enum(['ARRIVED', 'NO_SHOW', 'UNDO_NO_SHOW']) }),
  ]).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Проверьте данные' }, { status: 400 });
  const { salon, id } = await ctx.params;
  try {
    if ('endMinute' in parsed.data) return NextResponse.json(await setAppointmentEnd(salon, id, parsed.data.endMinute));
    if ('action' in parsed.data) {
      const act = parsed.data.action;
      if (act === 'ARRIVED') await markArrived(salon, id);
      else if (act === 'NO_SHOW') await markNoShow(salon, id);
      else await undoNoShow(salon, id);
      return NextResponse.json({ ok: true });
    }
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
