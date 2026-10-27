import { NextResponse, type NextRequest } from 'next/server';
import { setMyBirthday } from '@/server/birthday';

/** Клиент указывает свой день рождения (один раз) */
export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  const body = await req.json().catch(() => null);
  try {
    await setMyBirthday((await ctx.params).salon, String(body?.date ?? ''));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
