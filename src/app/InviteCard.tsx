'use client';

import { useState } from 'react';
import { useT } from './Lang';

/** «Пригласить друга»: ссылка с кодом клиента — через WhatsApp, «Поделиться» телефона или копированием */
export default function InviteCard({ slug, salonName, code, bonus, invited }: {
  slug: string; salonName: string; code: string; bonus: number; invited: { name: string; came: boolean }[];
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const link = () => `${location.origin}/${slug}?ref=${code}`;
  const text = () => t('Записываюсь в салон «{salon}» через приложение — удобно, с напоминаниями и баллами. Попробуй: {link}', { salon: salonName, link: link() });
  const came = invited.filter((i) => i.came).length;
  return (
    <section className="card stack" style={{ gap: 10, borderColor: 'var(--gold)', background: 'linear-gradient(160deg,#fff,#eef3ea)' }}>
      <strong style={{ fontSize: 17 }}>🤝 {t('Пригласите друга')} — <span style={{ color: 'var(--accent-dark)' }}>{t('{n} баллов', { n: bonus })}</span></strong>
      <span className="small muted" style={{ lineHeight: 1.45 }}>
        {t('Отправьте другу свою ссылку. Когда он впервые запишется по ней и оплатит визит, вам начислится {n} баллов.', { n: bonus })}
      </span>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn primary" style={{ flex: '1 1 140px', minHeight: 44 }}
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text())}`, '_blank')}>{t('Отправить в WhatsApp')}</button>
        <button type="button" className="btn" style={{ flex: '1 1 120px', minHeight: 44 }} onClick={async () => {
          if (navigator.share) { await navigator.share({ title: salonName, text: text() }).catch(() => {}); return; }
          await navigator.clipboard?.writeText(link()).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000);
        }}>{copied ? '✓ ' + t('Ссылка скопирована') : t('Поделиться')}</button>
      </div>
      {invited.length > 0 && (
        <span className="small">{t('Вы пригласили')}: <b>{invited.length}</b>{came ? <> · {t('уже пришли')}: <b>{came}</b> (+{t('{n} баллов', { n: came * bonus })})</> : ` · ${t('ждём их в салоне')}`}</span>
      )}
    </section>
  );
}
