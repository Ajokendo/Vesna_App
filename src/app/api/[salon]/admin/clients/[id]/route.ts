import { NextResponse, type NextRequest } from 'next/server';
import { isAdmin } from '@/server/admin-auth';
import { ClientEdit, updateClient } from '@/server/clients';
import { setReferrerByPhone } from '@/server/referral';
import { getSalon } from '@/server/salon';

/** Изменить имя, телефон, дату рождения или заметку клиента */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ salon: string; id: string }> }) {
  if (!(await isAdmin((await ctx.params).salon))) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const raw = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (raw && 'referrerPhone' in raw) {
    const { salon, id } = await ctx.params;
    const sal = await getSalon(salon);
    if (!sal) return NextResponse.json({ error: 'Салон не найден' }, { status: 404 });
    try {
      return NextResponse.json({ referrer: await setReferrerByPhone(sal.id, id, raw.referrerPhone ? String(raw.referrerPhone) : null) });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 409 });
    }
  }
  const parsed = ClientEdit.safeParse(raw);
  if (!parsed.success) {
    const f = String(parsed.error.issues[0]?.path.at(-1) ?? '');
    return NextResponse.json({ error: `Проверьте поле «${({ name: 'Имя', phone: 'Телефон', birthDate: 'День рождения', note: 'Заметка' } as Record<string, string>)[f] ?? f}»` }, { status: 400 });
  }
  const { salon, id } = await ctx.params;
  try {
    return NextResponse.json(await updateClient(salon, id, parsed.data));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
