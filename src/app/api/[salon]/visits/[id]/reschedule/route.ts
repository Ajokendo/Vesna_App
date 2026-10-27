import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { checkId } from '@/server/push';
import { rescheduleAppointment, rescheduleOptions } from '@/server/clients';

type Ctx = { params: Promise<{ salon: string; id: string }> };
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function allowed(req: NextRequest, id: string) {
  return checkId(id, req.nextUrl.searchParams.get('t') ?? '');
}

/** Клиент: свободное время для переноса на день ?date= */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { salon, id } = await ctx.params;
  if (!(await allowed(req, id))) return NextResponse.json({ error: 'Ссылка устарела' }, { status: 403 });
  const date = DateStr.safeParse(req.nextUrl.searchParams.get('date'));
  if (!date.success) return NextResponse.json({ error: 'Нужна дата' }, { status: 400 });
  try {
    return NextResponse.json(await rescheduleOptions(salon, id, date.data, 'CLIENT'));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}

/** Клиент переносит свою запись: { staffId, date, minute } */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { salon, id } = await ctx.params;
  if (!(await allowed(req, id))) return NextResponse.json({ error: 'Ссылка устарела' }, { status: 403 });
  const parsed = z.object({ staffId: z.string().min(1), date: DateStr, minute: z.number().int().min(0).max(24 * 60) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Проверьте данные' }, { status: 400 });
  try {
    return NextResponse.json(await rescheduleAppointment(salon, id, parsed.data, 'CLIENT'));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
