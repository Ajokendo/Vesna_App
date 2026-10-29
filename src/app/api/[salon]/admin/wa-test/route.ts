import { NextResponse, type NextRequest } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { isAdmin } from '@/server/admin-auth';
import { getSalon } from '@/server/salon';
import { sendWa, waNumber, waProviderReady } from '@/server/whatsapp';

type Ctx = { params: Promise<{ salon: string }> };

/** Тестовое WhatsApp-сообщение из «Настройки → Салон» */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { salon: slug } = await ctx.params;
  if (!(await isAdmin(slug))) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const salon = await getSalon(slug);
  if (!salon) return NextResponse.json({ error: 'Салон не найден' }, { status: 404 });
  if (!waProviderReady(salon)) return NextResponse.json({ error: 'Номер WhatsApp ещё не подключён на сервере' }, { status: 409 });
  const { phone } = await req.json().catch(() => ({}));
  if (!waNumber(phone)) return NextResponse.json({ error: 'Проверьте номер телефона' }, { status: 400 });
  const ok = await sendWa(salon, { phone, template: 'test', params: [salon.name], test: true });
  if (ok) return NextResponse.json({ ok: true });
  const last = await db.query.waMessages.findFirst({ where: eq(s.waMessages.salonId, salon.id), orderBy: desc(s.waMessages.createdAt) });
  return NextResponse.json({ error: `Не отправилось: ${last?.error ?? 'неизвестная ошибка'}` }, { status: 502 });
}
