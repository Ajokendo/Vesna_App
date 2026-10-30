import { NextResponse, type NextRequest } from 'next/server';
import { isAdmin } from '@/server/admin-auth';
import { certificateReceipt } from '@/server/certificates';

/** Чек перевода по заявке на сертификат — открывается у администратора */
export async function GET(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  const { salon } = await ctx.params;
  if (!(await isAdmin(salon))) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const data = await certificateReceipt(salon, req.nextUrl.searchParams.get('id') ?? '');
  const m = data?.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!m) return NextResponse.json({ error: 'Чек не найден' }, { status: 404 });
  return new NextResponse(Buffer.from(m[2], 'base64'), { headers: { 'content-type': m[1], 'cache-control': 'private, no-store' } });
}
