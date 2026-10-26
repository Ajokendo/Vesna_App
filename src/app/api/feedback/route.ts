import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { db, schema as s } from '@/db';
import { gte } from 'drizzle-orm';

const Body = z.object({
  salon: z.string().max(60).nullable(),
  role: z.enum(['CLIENT', 'MASTER', 'ADMIN']),
  text: z.string().trim().min(3, 'Напишите, что случилось').max(3000),
  contact: z.string().trim().max(120).nullable(),
  page: z.string().max(300).nullable(),
  device: z.string().max(500).nullable(),
});

/** Сообщение разработчикам. Простая защита от спама: не больше 30 сообщений в 10 минут на весь сайт */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Проверьте сообщение' }, { status: 400 });
  const recent = await db.select({ id: s.feedback.id }).from(s.feedback).where(gte(s.feedback.createdAt, new Date(Date.now() - 10 * 60000)));
  if (recent.length > 30) return NextResponse.json({ error: 'Слишком много сообщений, попробуйте позже' }, { status: 429 });
  const d = parsed.data;
  await db.insert(s.feedback).values({ salonSlug: d.salon, role: d.role, text: d.text, contact: d.contact || null, page: d.page, device: d.device });
  await notifyTelegram(`📩 ${d.role === 'CLIENT' ? 'Клиент' : d.role === 'MASTER' ? 'Мастер' : 'Администратор'} · ${d.salon ?? '—'}\n${d.text}${d.contact ? `\nКонтакт: ${d.contact}` : ''}`);
  return NextResponse.json({ ok: true });
}

/** Если в настройках сервера заданы TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID — копия сообщения в Telegram разработчику */
async function notifyTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN; const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text: text.slice(0, 3500) }),
  }).catch(() => {});
}
