'use client';

import { useState } from 'react';

export default function ConfirmButton({ slug, id, token, confirmed }: { slug: string; id: string; token: string; confirmed: boolean }) {
  const [done, setDone] = useState(confirmed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (done) return <div className="note" style={{ width: '100%', textAlign: 'center', fontWeight: 700 }}>✓ Визит подтверждён — ждём вас!</div>;
  return (
    <>
      <button type="button" className="btn primary block" disabled={busy} onClick={async () => {
        setBusy(true); setError(null);
        const res = await fetch(`/api/${slug}/visits/${id}/confirm?t=${encodeURIComponent(token)}`, { method: 'POST' });
        setBusy(false);
        if (res.ok) setDone(true); else setError((await res.json().catch(() => ({}))).error ?? 'Не получилось');
      }}>{busy ? 'Подтверждаем…' : 'Подтвердить визит'}</button>
      {error && <div className="error" role="alert">{error}</div>}
    </>
  );
}
