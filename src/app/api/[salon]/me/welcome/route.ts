import { NextResponse, type NextRequest } from 'next/server';
import { grantWelcomeBonus } from '@/server/me';

/** Приложение открыто как установленное — подарочные баллы (один раз) */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  const { salon } = await ctx.params;
  return NextResponse.json(await grantWelcomeBonus(salon));
}
