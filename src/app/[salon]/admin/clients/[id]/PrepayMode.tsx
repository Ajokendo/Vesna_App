'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Mode = 'ALWAYS' | 'NEVER' | null;

/** Предоплата для клиента: по числу неявок (как в настройках), всегда или не просить */
export default function PrepayMode({ slug, clientId, mode, noShows, after }: { slug: string; clientId: string; mode: Mode; noShows: number; after: number }) {
  const router = useRouter();
  const [m, setM] = useState<Mode>(mode);
  const [busy, setBusy] = useState(false);
  const auto = noShows >= after;
  const now = m === 'ALWAYS' || (m == null && auto);
  async function set(next: Mode) {
    setBusy(true);
    const r = await fetch(`/api/${slug}/admin/prepay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'client', clientId, mode: next }) });
    setBusy(false);
    if (r.ok) { setM(next); router.refresh(); }
  }
  const opts: [Mode, string][] = [[null, `По неявкам (с ${after})`], ['ALWAYS', 'Всегда'], ['NEVER', 'Не просить']];
  return (
    <div className="stack" style={{ gap: 6, background: now ? '#fff6e5' : 'var(--ground)', borderRadius: 14, padding: 12 }}>
      <strong className="small">💳 Предоплата при онлайн-записи: {now ? 'нужна' : 'не нужна'}</strong>
      <div className="tabs" role="group" aria-label="Предоплата для клиента">
        {opts.map(([v, label]) => <button key={label} type="button" disabled={busy} aria-pressed={m === v} onClick={() => set(v)}>{label}</button>)}
      </div>
    </div>
  );
}
