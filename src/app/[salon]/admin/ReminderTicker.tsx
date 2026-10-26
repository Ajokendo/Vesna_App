'use client';

import { useEffect } from 'react';

/** Пока журнал открыт, раз в 5 минут запускаем рассылку напоминаний «за час» (каждое уходит один раз) */
export default function ReminderTicker() {
  useEffect(() => {
    const tick = () => { fetch('/api/cron/notify').catch(() => {}); };
    tick();
    const t = setInterval(tick, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  return null;
}
