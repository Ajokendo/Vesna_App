import { NextResponse } from 'next/server';
import { runDueReminders } from '@/server/notify';

export const dynamic = 'force-dynamic';

// Будильник напоминаний: утреннее (с 08:00) и за час до визита. Вызывается по расписанию Vercel (утром),
// открытым журналом администратора каждые 5 минут и, при желании, внешним сервисом-будильником.
// Безопасно вызывать сколько угодно раз — каждое напоминание уходит один раз.
export async function GET() {
  return NextResponse.json(await runDueReminders());
}
