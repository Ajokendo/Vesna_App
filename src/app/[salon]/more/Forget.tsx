'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** «Это не мой телефон» — забыть клиента на этом устройстве */
export default function Forget({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  if (!ask) {
    return <button type="button" className="small" onClick={() => setAsk(true)} style={{ border: 0, background: 'none', padding: 0, color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer', alignSelf: 'flex-start' }}>Это не мой телефон / выйти</button>;
  }
  return (
    <div className="row small" style={{ gap: 8, flexWrap: 'wrap' }}>
      <span>Телефон забудет {name}: записи и баллы не пропадут, просто не будут здесь видны.</span>
      <button type="button" className="btn" style={{ minHeight: 38 }} onClick={() => setAsk(false)}>Нет</button>
      <button type="button" className="btn" style={{ minHeight: 38 }} onClick={async () => { await fetch(`/api/${slug}/me`, { method: 'DELETE' }); router.refresh(); }}>Да, выйти</button>
    </div>
  );
}
