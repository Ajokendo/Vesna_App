'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { hhmm } from '@/lib/time';
import Tip from './Tip';

/** Время окончания записи: мастер закончит раньше или задержится (журнал администратора и кабинет мастера) */
export default function EndTimeEditor({ start, end: initialEnd, url, compact }: { start: number; end: number; url: string; compact?: boolean }) {
  const router = useRouter();
  const [end, setEnd] = useState(initialEnd);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const changed = end !== initialEnd;
  const shift = (d: number) => { setSaved(false); setError(null); setEnd((e) => Math.max(start + 5, Math.min(24 * 60, e + d))); };

  async function save() {
    setBusy(true); setError(null);
    const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endMinute: end }) });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Не получилось'); return; }
    setSaved(true);
    router.refresh();
  }

  const small = { minHeight: 36, padding: '0 10px', fontSize: 13 } as const;
  return (
    <div className="stack" style={{ gap: 8, background: 'var(--ground)', borderRadius: 14, padding: compact ? 10 : 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
        <span className="small" style={{ fontWeight: 700 }}>{compact ? 'Закончу в' : 'Время'}</span>
        <span style={{ fontWeight: 800 }}>
          {hhmm(start)}–{hhmm(end)}
          <span className="small muted" style={{ fontWeight: 500 }}> · {end - start} мин{changed ? ` (было до ${hhmm(initialEnd)})` : ''}</span>
        </span>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {!compact && <span className="small muted row" style={{ marginRight: 2, gap: 4 }}>Окончание: <Tip text="Мастер задерживается или закончит раньше — поправьте время. Онлайн-запись сразу подстроится, следующий клиент не наложится." /></span>}
        <button type="button" className="btn" style={small} onClick={() => shift(-15)}>−15</button>
        <button type="button" className="btn" style={small} onClick={() => shift(-5)}>−5</button>
        <button type="button" className="btn" style={small} onClick={() => shift(5)}>+5</button>
        <button type="button" className="btn" style={small} onClick={() => shift(15)}>+15</button>
        <input type="time" step={300} aria-label="Время окончания" value={hhmm(end)}
          onChange={(e) => { const [h, m] = e.target.value.split(':').map(Number); if (!Number.isNaN(h)) { setSaved(false); setEnd(h * 60 + m); } }}
          style={{ minHeight: 36, borderRadius: 10, border: '1px solid #dde5de', padding: '0 8px', fontSize: 14 }} />
      </div>
      {changed && !saved && (
        <button type="button" className="btn primary" style={{ minHeight: 40 }} disabled={busy} onClick={save}>
          {busy ? 'Сохраняем…' : end < initialEnd ? `Закончу в ${hhmm(end)} — освободить время` : `Закончу в ${hhmm(end)} — продлить`}
        </button>
      )}
      {saved && <span className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>✓ Сохранено — журнал и онлайн-запись обновились</span>}
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}
