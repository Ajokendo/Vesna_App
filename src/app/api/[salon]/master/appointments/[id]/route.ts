import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSalon } from '@/server/salon';
import { currentMaster } from '@/server/master-auth';
import { markArrived, markNoShow, setAppointmentEnd } from '@/server/absence';

/** Мастер сам отмечает, что закончит раньше или задержится (только по своим записям) */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ salon: string; id: string }> }) {
  const { salon: slug, id } = await ctx.params;
  const salon = await getSalon(slug);
  if (!salon) return NextResponse.json({ error: 'Салон не найден' }, { status: 404 });
  const me = await currentMaster(salon.id);
  if (!me) return NextResponse.json({ error: 'Войдите в кабинет мастера' }, { status: 401 });
  const parsed = z.union([
    z.object({ endMinute: z.number().int().min(0).max(24 * 60) }),
    z.object({ action: z.enum(['ARRIVED', 'NO_SHOW']) }),
  ]).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Проверьте данные' }, { status: 400 });
  const by = { role: 'MASTER' as const, staffId: me.id };
  try {
    if ('action' in parsed.data) {
      if (parsed.data.action === 'ARRIVED') await markArrived(slug, id, by); else await markNoShow(slug, id, by);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(await setAppointmentEnd(slug, id, parsed.data.endMinute, by));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
