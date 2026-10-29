'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { disable } from '@/app/passkey-client';
import { useT } from '@/app/Lang';

/** «Это не мой телефон» — забыть клиента на этом устройстве */
export default function Forget({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const t = useT();
  const [ask, setAsk] = useState(false);
  if (!ask) {
    return <button type="button" className="small" onClick={() => setAsk(true)} style={{ border: 0, background: 'none', padding: 0, color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer', alignSelf: 'center' }}>{t('Это не мой телефон / выйти')}</button>;
  }
  return (
    <div className="row small" style={{ gap: 8, flexWrap: 'wrap' }}>
      <span>{t('Телефон забудет {name}: записи и баллы не пропадут, просто не будут здесь видны.', { name })}</span>
      <button type="button" className="btn" style={{ minHeight: 38 }} onClick={() => setAsk(false)}>{t('Нет')}</button>
      <button type="button" className="btn" style={{ minHeight: 38 }} onClick={async () => { await disable(slug, 'CLIENT').catch(() => {}); await fetch(`/api/${slug}/me`, { method: 'DELETE' }); router.refresh(); }}>{t('Да, выйти')}</button>
    </div>
  );
}
