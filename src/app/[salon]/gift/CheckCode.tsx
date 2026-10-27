'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** «У меня есть сертификат» — открыть его по коду и увидеть остаток */
export default function CheckCode({ slug }: { slug: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const ok = code.replace(/[^A-Za-z0-9]/g, '').length === 8;
  return (
    <section className="card stack" style={{ gap: 8 }}>
      <strong>У меня есть сертификат</strong>
      <span className="small muted">Введите код — увидите сумму, остаток и срок.</span>
      <div className="row" style={{ gap: 8 }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Например K7QM-4XRA" aria-label="Код сертификата" autoCapitalize="characters"
          style={{ minHeight: 46, borderRadius: 12, border: '1px solid #dde5de', padding: '0 12px', fontSize: 16, flex: 1, minWidth: 0, letterSpacing: 1 }} />
        <button type="button" className="btn primary" disabled={!ok} onClick={() => router.push(`/${slug}/c/${encodeURIComponent(code.trim())}`)}>Открыть</button>
      </div>
    </section>
  );
}
