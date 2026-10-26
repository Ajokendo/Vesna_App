import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAppointment } from '@/server/salon';
import { rememberClient } from '@/server/me';
import { attachReferral } from '@/server/referral';

const Body = z.object({
  serviceId: z.string().min(1),
  staffId: z.string().min(1),
  length: z.enum(['SHORT', 'MEDIUM', 'LONG', 'XLONG']).nullable().optional(),
  addonIds: z.array(z.string()).default([]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minute: z.number().int().min(0).max(24 * 60),
  client: z.object({
    name: z.string().trim().min(2, 'Укажите имя'),
    phone: z.string().trim().regex(/^\+?\d[\d\s()-]{8,}$/, 'Проверьте номер телефона'),
  }),
  forChild: z.object({ name: z.string().trim().min(2), birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).nullable().optional(),
  payment: z.string().nullable().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  const { salon } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Проверьте данные';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  try {
    const { clientId, isNewClient, ...res } = await createAppointment(salon, { ...parsed.data, source: 'ONLINE' });
    await attachReferral(salon, clientId, isNewClient).catch(() => {});
    // этот телефон запоминает клиента: «Мои записи» и «Баллы» без паролей
    await rememberClient(salon, clientId);
    return NextResponse.json(res, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
