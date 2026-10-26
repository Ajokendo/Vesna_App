import { NextResponse, type NextRequest } from 'next/server';
import { checkId } from '@/server/push';
import { clientCancels } from '@/server/absence';

/** Клиент сам отменяет запись: «Не смогу прийти» */
export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string; id: string }> }) {
  const { id } = await ctx.params;
  if (!(await checkId(id, req.nextUrl.searchParams.get('t') ?? ''))) return NextResponse.json({ error: 'Ссылка устарела' }, { status: 403 });
  try {
    await clientCancels(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
