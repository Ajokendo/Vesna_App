'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/app/Lang';

/** Клиент на странице своей записи: «Опаздываю» / «Не смогу прийти» */
export default function LateButtons({ slug, id, token, lateMinutes }: { slug: string; id: string; token: string; lateMinutes: number | null }) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState<string | null>(lateMinutes ? t('Вы предупредили, что опоздаете на {n} мин. Мастер подождёт.', { n: lateMinutes }) : null);
  const [error, setError] = useState<string | null>(null);
  const q = `?t=${encodeURIComponent(token)}`;

  async function late(minutes: number) {
    setBusy(true); setError(null);
    const res = await fetch(`/api/${slug}/visits/${id}/late${q}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes }) });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? t('Не получилось')); return; }
    setMsg(t('Спасибо, что предупредили! Ждём вас — мастер в курсе, что вы опоздаете на {n} мин.', { n: minutes }));
  }
  async function cancel() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/${slug}/visits/${id}/cancel${q}`, { method: 'POST' });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? t('Не получилось')); return; }
    router.refresh();
  }

  return (
    <section className="card stack" style={{ gap: 10 }}>
      <strong>{t('Опаздываете или не получается прийти?')}</strong>
      {msg && <div className="note">{msg}</div>}
      <div className="grid2">
        <button type="button" className="btn" disabled={busy} onClick={() => late(10)}>{t('Опоздаю на {n} мин', { n: 10 })}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => late(20)}>{t('Опоздаю на {n} мин', { n: 20 })}</button>
      </div>
      {ask ? (
        <div className="row" style={{ gap: 8 }}>
          <span className="small grow">{t('Отменить запись? Время освободится для других клиентов.')}</span>
          <button type="button" className="btn" onClick={() => setAsk(false)}>{t('Нет')}</button>
          <button type="button" className="btn" style={{ color: 'var(--danger)' }} disabled={busy} onClick={cancel}>{t('Да, отменить')}</button>
        </div>
      ) : (
        <button type="button" className="btn block" style={{ color: 'var(--danger)' }} onClick={() => setAsk(true)}>{t('Не смогу прийти')}</button>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </section>
  );
}
