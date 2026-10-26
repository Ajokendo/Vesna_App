import { NextResponse, type NextRequest } from 'next/server';
import { rememberReferral } from '@/server/referral';

/** Открыта ссылка приглашения (?ref=КОД): телефон запоминает, кто пригласил */
export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  const body = await req.json().catch(() => null) as { code?: string } | null;
  const code = String(body?.code ?? '').slice(0, 12);
  if (!code) return NextResponse.json({ ok: false }, { status: 400 });
  const { salon } = await ctx.params;
  return NextResponse.json({ ok: await rememberReferral(salon, code) });
}
