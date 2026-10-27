import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAdmin } from '@/server/admin-auth';
import { cancelCertificate, CERT_STATUS, CertSettings, findCertificate, IssueInput, issueCertificate, setCertificateSettings } from '@/server/certificates';
import { dayMonth, utcToZoned } from '@/lib/time';

type Ctx = { params: Promise<{ salon: string }> };

/** Проверить сертификат по коду (в окне оплаты) */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { salon } = await ctx.params;
  if (!(await isAdmin(salon))) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const { salon: sa, cert } = await findCertificate(salon, req.nextUrl.searchParams.get('code') ?? '');
  if (!cert) return NextResponse.json({ error: 'Сертификат с таким кодом не найден' }, { status: 404 });
  if (cert.status !== 'ACTIVE') return NextResponse.json({ error: `Сертификат: ${CERT_STATUS[cert.status].toLowerCase()}` }, { status: 409 });
  const exp = utcToZoned(cert.expiresAt, sa.timezone).date;
  return NextResponse.json({ code: cert.code, balance: cert.balance, amount: cert.amount, toName: cert.toName, expires: `${dayMonth(exp)} ${exp.slice(0, 4)}` });
}

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('settings'), data: CertSettings }),
  z.object({ action: z.literal('issue'), data: IssueInput }),
  z.object({ action: z.literal('cancel'), id: z.string().min(1) }),
]);

export async function POST(req: NextRequest, ctx: Ctx) {
  const { salon } = await ctx.params;
  if (!(await isAdmin(salon))) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Проверьте данные' }, { status: 400 });
  try {
    const b = parsed.data;
    if (b.action === 'settings') { await setCertificateSettings(salon, b.data); return NextResponse.json({ ok: true }); }
    if (b.action === 'issue') { const c = await issueCertificate(salon, b.data); return NextResponse.json({ ok: true, id: c.id, code: c.code }); }
    await cancelCertificate(salon, b.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
