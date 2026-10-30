'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/app/Lang';

/** «У меня есть сертификат» — открыть его по коду и увидеть остаток */
export default function CheckCode({ slug, hasOwn }: { slug: string; hasOwn?: boolean }) {
  const router = useRouter();
  const t = useT();
  const [code, setCode] = useState('');
  const ok = code.replace(/[^A-Za-z0-9]/g, '').length === 8;
  return (
    <section className="card stack" style={{ gap: 8 }}>
      <strong>{t('У меня есть сертификат')}</strong>
      <span className="small muted">{hasOwn ? t('Ваши сертификаты с кодами — выше. Здесь можно проверить сертификат, который прислали ссылкой: код из 8 знаков есть на нём.') : t('Код из 8 знаков — на сертификате, который вам прислали ссылкой. Введите его — увидите сумму, остаток и срок.')}</span>
      <div className="row" style={{ gap: 8 }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t('Например K7QM-4XRA')} aria-label={t('Код сертификата')} autoCapitalize="characters"
          style={{ minHeight: 46, borderRadius: 12, border: '1px solid #dde5de', padding: '0 12px', fontSize: 16, flex: 1, minWidth: 0, letterSpacing: 1 }} />
        <button type="button" className="btn primary" disabled={!ok} onClick={() => router.push(`/${slug}/c/${encodeURIComponent(code.trim())}`)}>{t('Открыть')}</button>
      </div>
    </section>
  );
}
