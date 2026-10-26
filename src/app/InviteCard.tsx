'use client';

import { useState } from 'react';

/** «Пригласить друга»: ссылка с кодом клиента — через WhatsApp, «Поделиться» телефона или копированием */
export default function InviteCard({ slug, salonName, code, bonus, invited }: {
  slug: string; salonName: string; code: string; bonus: number; invited: { name: string; came: boolean }[];
}) {
  const [copied, setCopied] = useState(false);
  const link = () => `${location.origin}/${slug}?ref=${code}`;
  const text = () => `Записываюсь в салон «${salonName}» через приложение — удобно, с напоминаниями и баллами. Попробуй: ${link()}`;
  const came = invited.filter((i) => i.came).length;
  return (
    <section className="card stack" style={{ gap: 10, borderColor: 'var(--gold)', background: 'linear-gradient(160deg,#fff,#eef3ea)' }}>
      <strong style={{ fontSize: 17 }}>🤝 Пригласите друга — <span style={{ color: 'var(--accent-dark)' }}>{bonus} баллов</span></strong>
      <span className="small muted" style={{ lineHeight: 1.45 }}>
        Отправьте другу свою ссылку. Когда он впервые запишется по ней и оплатит визит, вам начислится {bonus} баллов.
      </span>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn primary" style={{ flex: '1 1 140px', minHeight: 44 }}
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text())}`, '_blank')}>Отправить в WhatsApp</button>
        <button type="button" className="btn" style={{ flex: '1 1 120px', minHeight: 44 }} onClick={async () => {
          if (navigator.share) { await navigator.share({ title: salonName, text: text() }).catch(() => {}); return; }
          await navigator.clipboard?.writeText(link()).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000);
        }}>{copied ? '✓ Ссылка скопирована' : 'Поделиться'}</button>
      </div>
      {invited.length > 0 && (
        <span className="small">Вы пригласили: <b>{invited.length}</b>{came ? <> · уже пришли: <b>{came}</b> (+{came * bonus} баллов)</> : ' · ждём их в салоне'}</span>
      )}
    </section>
  );
}
