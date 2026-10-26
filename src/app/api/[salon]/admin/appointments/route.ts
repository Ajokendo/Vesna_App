import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAppointment } from '@/server/salon';
import { isAdmin } from '@/server/admin-auth';

const Body = z.object({
  serviceId: z.string().min(1),
  staffId: z.string().min(1),
  length: z.enum(['SHORT', 'MEDIUM', 'LONG', 'XLONG']).nullable().optional(),
  addonIds: z.array(z.string()).default([]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minute: z.number().int().min(0).max(24 * 60),
  client: z.object({ name: z.string().trim().min(1), phone: z.string().trim().default('') }),
  source: z.enum(['ADMIN', 'WALK_IN']),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  if (!(await isAdmin((await ctx.params).salon))) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const { salon } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Проверьте данные' }, { status: 400 });
  try {
    return NextResponse.json(await createAppointment(salon, parsed.data), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
