import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAdmin } from '@/server/admin-auth';
import { importAppointments } from '@/server/import';

const Body = z.object({ text: z.string().max(200_000), commit: z.boolean().default(false) });

/** Перенос записей из бумажного журнала: commit=false — только проверка, true — загрузить */
export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  const { salon } = await ctx.params;
  if (!(await isAdmin(salon))) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Проверьте данные' }, { status: 400 });
  try {
    return NextResponse.json(await importAppointments(salon, parsed.data.text, parsed.data.commit));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
