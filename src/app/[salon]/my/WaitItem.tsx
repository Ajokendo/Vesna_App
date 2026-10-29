'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/app/Lang';

/** Заявка в листе ожидания в «Моих записях»: можно убрать */
export default function WaitItem({ slug, id, title, sub, notified }: { slug: string; id: string; title: string; sub: string; notified: boolean }) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    await fetch(`/api/${slug}/waitlist?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    router.refresh();
  }
  return (
    <div className="card row" style={{ gap: 10, padding: '10px 14px', borderStyle: 'dashed' }}>
      <span className="grow stack" style={{ gap: 1, minWidth: 0 }}>
        <strong>⏳ {title}</strong>
        <span className="small muted">{sub}{notified ? ` · ${t('время освобождалось — проверьте уведомление')}` : ''}</span>
      </span>
      <button type="button" className="small" disabled={busy} onClick={remove} style={{ border: 0, background: 'none', color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer' }}>{t('убрать')}</button>
    </div>
  );
}
