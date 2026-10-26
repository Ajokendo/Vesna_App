'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Клиент на странице своей записи: «Опаздываю» / «Не смогу прийти» */
export default function LateButtons({ slug, id, token, lateMinutes }: { slug: string; id: string; token: string; lateMinutes: number | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState<string | null>(lateMinutes ? `Вы предупредили, что опоздаете на ${lateMinutes} мин. Мастер подождёт.` : null);
  const [error, setError] = useState<string | null>(null);
  const q = `?t=${encodeURIComponent(token)}`;

  async function late(minutes: number) {
    setBusy(true); setError(null);
    const res = await fetch(`/api/${slug}/visits/${id}/late${q}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes }) });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Не получилось'); return; }
    setMsg(`Спасибо, что предупредили! Ждём вас — мастер в курсе, что вы опоздаете на ${minutes} мин.`);
  }
  async function cancel() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/${slug}/visits/${id}/cancel${q}`, { method: 'POST' });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Не получилось'); return; }
    router.refresh();
  }

  return (
    <section className="card stack" style={{ gap: 10 }}>
      <strong>Опаздываете или не получается прийти?</strong>
      {msg && <div className="note">{msg}</div>}
      <div className="grid2">
        <button type="button" className="btn" disabled={busy} onClick={() => late(10)}>Опоздаю на 10 мин</button>
        <button type="button" className="btn" disabled={busy} onClick={() => late(20)}>Опоздаю на 20 мин</button>
      </div>
      {ask ? (
        <div className="row" style={{ gap: 8 }}>
          <span className="small grow">Отменить запись? Время освободится для других клиентов.</span>
          <button type="button" className="btn" onClick={() => setAsk(false)}>Нет</button>
          <button type="button" className="btn" style={{ color: 'var(--danger)' }} disabled={busy} onClick={cancel}>Да, отменить</button>
        </div>
      ) : (
        <button type="button" className="btn block" style={{ color: 'var(--danger)' }} onClick={() => setAsk(true)}>Не смогу прийти</button>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </section>
  );
}
