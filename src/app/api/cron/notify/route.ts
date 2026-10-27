import { NextResponse } from 'next/server';
import { runDueReminders } from '@/server/notify';
import { runBirthdays } from '@/server/birthday';

export const dynamic = 'force-dynamic';

// Будильник напоминаний: утреннее (с 08:00) и за час до визита; поздравления с днём рождения (с 09:00). Вызывается по расписанию Vercel (утром),
// открытым журналом администратора каждые 5 минут и, при желании, внешним сервисом-будильником.
// Безопасно вызывать сколько угодно раз — каждое напоминание уходит один раз.
export async function GET() {
  const reminders = await runDueReminders();
  const birthdays = await runBirthdays().catch((e) => ({ error: (e as Error).message }));
  return NextResponse.json({ ...reminders, ...birthdays });
}
