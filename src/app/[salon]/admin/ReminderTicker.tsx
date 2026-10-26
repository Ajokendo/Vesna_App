'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Пока журнал открыт: раз в минуту обновляем его (видны новые онлайн-записи и время, которое отметили мастера),
 * раз в 5 минут запускаем рассылку напоминаний «за час» (каждое уходит один раз).
 */
export default function ReminderTicker() {
  const router = useRouter();
  useEffect(() => {
    const tick = () => { fetch('/api/cron/notify').catch(() => {}); };
    tick();
    const t1 = setInterval(tick, 5 * 60 * 1000);
    const t2 = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 60 * 1000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [router]);
  return null;
}
