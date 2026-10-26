import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSalon } from '@/server/salon';
import { currentMaster } from '@/server/master-auth';
import { setAppointmentEnd } from '@/server/absence';

/** Мастер сам отмечает, что закончит раньше или задержится (только по своим записям) */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ salon: string; id: string }> }) {
  const { salon: slug, id } = await ctx.params;
  const salon = await getSalon(slug);
  if (!salon) return NextResponse.json({ error: 'Салон не найден' }, { status: 404 });
  const me = await currentMaster(salon.id);
  if (!me) return NextResponse.json({ error: 'Войдите в кабинет мастера' }, { status: 401 });
  const parsed = z.object({ endMinute: z.number().int().min(0).max(24 * 60) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Проверьте время' }, { status: 400 });
  try {
    return NextResponse.json(await setAppointmentEnd(slug, id, parsed.data.endMinute, { role: 'MASTER', staffId: me.id }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
