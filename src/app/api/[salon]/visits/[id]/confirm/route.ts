import { NextResponse, type NextRequest } from 'next/server';
import { checkId } from '@/server/push';
import { confirmVisit } from '@/server/notify';

/** Клиент подтверждает визит — из уведомления или со страницы записи */
export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string; id: string }> }) {
  const { id } = await ctx.params;
  const token = req.nextUrl.searchParams.get('t') ?? '';
  if (!(await checkId(id, token))) return NextResponse.json({ error: 'Ссылка устарела' }, { status: 403 });
  try {
    return NextResponse.json(await confirmVisit(id));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
