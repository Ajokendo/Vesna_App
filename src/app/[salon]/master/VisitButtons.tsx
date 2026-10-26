'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Кабинет мастера: клиент пришёл / не пришёл */
export default function VisitButtons({ slug, id, canNoShow }: { slug: string; id: string; canNoShow: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(action: 'ARRIVED' | 'NO_SHOW') {
    setBusy(true); setError(null);
    const res = await fetch(`/api/${slug}/master/appointments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Не получилось'); return; }
    router.refresh();
  }
  const st = { minHeight: 34, padding: '0 10px', fontSize: 13 } as const;
  return (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      <button type="button" className="btn primary" style={st} disabled={busy} onClick={() => act('ARRIVED')}>Пришёл</button>
      {canNoShow && <button type="button" className="btn" style={{ ...st, color: 'var(--danger)' }} disabled={busy} onClick={() => act('NO_SHOW')}>Не пришёл</button>}
      {error && <span className="small" style={{ color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}
