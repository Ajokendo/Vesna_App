import { NextResponse, type NextRequest } from 'next/server';
import { BuyInput, requestCertificate } from '@/server/certificates';
import { rememberClient } from '@/server/me';

/** Клиент покупает сертификат в приложении: перевод + чек, салон подтверждает */
export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  const { salon } = await ctx.params;
  const parsed = BuyInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Проверьте данные' }, { status: 400 });
  try {
    const { buyerId } = await requestCertificate(salon, parsed.data);
    await rememberClient(salon, buyerId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
