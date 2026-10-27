import { NextResponse, type NextRequest } from 'next/server';
import { closeWaitlist, joinWaitlist, JoinInput } from '@/server/waitlist';
import { rememberClient } from '@/server/me';

type Ctx = { params: Promise<{ salon: string }> };

/** Встать в лист ожидания */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { salon } = await ctx.params;
  const parsed = JoinInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Проверьте данные' }, { status: 400 });
  try {
    const { clientId } = await joinWaitlist(salon, parsed.data);
    await rememberClient(salon, clientId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}

/** Клиент убирает свою заявку */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { salon } = await ctx.params;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Не указана заявка' }, { status: 400 });
  try {
    await closeWaitlist(salon, id, 'CLIENT');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}
