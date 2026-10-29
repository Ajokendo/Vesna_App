'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from './Lang';

/** «Укажите день рождения — подарим N баллов»: в «Баллах», пока клиент не указал дату */
export default function BirthdayCard({ slug, bonus }: { slug: string; bonus: number }) {
  const router = useRouter();
  const t = useT();
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/${slug}/me/birthday`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date }) });
    setBusy(false);
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? t('Не получилось')); return; }
    router.refresh();
  }
  return (
    <section className="card stack" style={{ gap: 8, borderColor: 'var(--gold)' }}>
      <strong>🎂 {t('Когда у вас день рождения?')}</strong>
      <span className="small muted" style={{ lineHeight: 1.45 }}>
        {bonus > 0 ? t('В этот день салон поздравит вас и подарит {n} баллов — если вы были у нас за последний год.', { n: bonus }) : t('В этот день салон вас поздравит.')} {t('Указать можно один раз.')}
      </span>
      <div className="row" style={{ gap: 8 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t('Дата рождения')}
          style={{ minHeight: 46, borderRadius: 12, border: '1px solid #dde5de', padding: '0 12px', fontSize: 16, flex: 1, minWidth: 0, background: '#fff' }} />
        <button type="button" className="btn primary" disabled={!date || busy} onClick={save}>{busy ? '…' : t('Сохранить')}</button>
      </div>
      {err && <div className="error" role="alert">{err}</div>}
    </section>
  );
}
