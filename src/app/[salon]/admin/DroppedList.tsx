'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { hhmm } from '@/lib/time';

type Item = { id: string; start: number; client: string; phone: string | null; service: string; master: string; reason: 'NO_SHOW' | 'CLIENT' | 'ADMIN' };
const REASON = { NO_SHOW: 'не пришёл', CLIENT: 'отменил сам', ADMIN: 'отменено салоном' } as const;

/** Не пришли и отменённые за день: время освобождено, запись осталась в истории */
export default function DroppedList({ slug, items }: { slug: string; items: Item[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  if (!items.length) return null;
  async function undo(id: string) {
    setError(null);
    const res = await fetch(`/api/${slug}/admin/appointments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'UNDO_NO_SHOW' }) });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Не получилось'); return; }
    router.refresh();
  }
  return (
    <details className="card" style={{ padding: '10px 16px' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Не пришли и отменённые: {items.length}</summary>
      <div className="stack" style={{ gap: 0, marginTop: 8 }}>
        {items.map((d) => (
          <div key={d.id} className="row" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', flexWrap: 'wrap', gap: 8 }}>
            <span className="grow small">
              <strong>{hhmm(d.start)} {d.client}</strong> · {d.service} · {d.master}{d.phone ? ` · ${d.phone}` : ''}
              <span style={{ color: d.reason === 'NO_SHOW' ? 'var(--danger)' : 'var(--muted)', fontWeight: 700 }}> — {REASON[d.reason]}</span>
            </span>
            {d.reason === 'NO_SHOW' && (
              <button type="button" className="btn" style={{ minHeight: 36, padding: '0 10px', fontSize: 13 }} onClick={() => undo(d.id)}>Всё-таки пришёл</button>
            )}
          </div>
        ))}
        {error && <div className="error" role="alert">{error}</div>}
      </div>
    </details>
  );
}
