'use client';

import { formatSom } from '@/lib/pricing';
import { useT } from './Lang';

/** Клиенту: запись ждёт предоплату — сумма, до какого времени и куда перевести */
export default function PrepayNotice({ amount, due, details }: { amount: number; due: string | null; details: string | null }) {
  const t = useT();
  return (
    <div className="stack" style={{ gap: 6, background: '#fff6e5', border: '1px solid #f0d9a8', borderRadius: 14, padding: 14, textAlign: 'left' }}>
      <strong>💳 {t('Нужна предоплата {sum}', { sum: formatSom(amount) })}{due ? ` — ${t('до {time}', { time: due })}` : ''}</strong>
      {details && <span style={{ whiteSpace: 'pre-wrap' }}>{t('Переведите на')}: <b>{details}</b></span>}
      <span className="small muted">{t('Вы уже пропускали визиты, поэтому для записи нужна предоплата. Администратор подтвердит перевод. Если предоплаты не будет, запись отменится автоматически.')}</span>
      <span className="small muted">{t('Предоплата засчитывается в стоимость услуги.')}</span>
    </div>
  );
}
