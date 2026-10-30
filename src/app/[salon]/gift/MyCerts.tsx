'use client';

import { formatSom } from '@/lib/pricing';
import { useT } from '@/app/Lang';

type Cert = { id: string; code: string; amount: number; balance: number; toName: string | null; fromName: string | null; status: string; mine: boolean; expires: string };

/** Мои сертификаты: купленные мной и подаренные мне. Отправить — ссылкой в WhatsApp */
export default function MyCerts({ slug, salonName, certs }: { slug: string; salonName: string; certs: Cert[] }) {
  const t = useT();
  if (!certs.length) return null;
  const share = (c: Cert) => {
    const url = `${location.origin}/${slug}/c/${c.code}`;
    const text = t('🎁 Подарочный сертификат салона «{salon}» на {sum}: {url}', { salon: salonName, sum: formatSom(c.amount), url });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };
  return (
    <section className="card stack" style={{ gap: 8 }}>
      <strong style={{ fontSize: 17 }}>{t('Мои сертификаты')}</strong>
      {certs.map((c) => (
        <div key={c.id} className="row" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 8, flexWrap: 'wrap', opacity: c.status === 'ACTIVE' || c.status === 'PENDING' ? 1 : 0.6 }}>
          <span className="grow stack" style={{ gap: 1, minWidth: 170 }}>
            <b>{formatSom(c.amount)}{c.balance !== c.amount && c.status === 'ACTIVE' ? ` · ${t('осталось')} ${formatSom(c.balance)}` : ''}</b>
            <span className="small muted">{[c.mine ? (c.toName ? `${t('кому')}: ${c.toName}` : t('куплен вами')) : `${t('от')}: ${c.fromName ?? ''}`, c.status === 'ACTIVE' ? `${t('до')} ${c.expires}` : null].filter(Boolean).join(' · ')}</span>
            {c.status === 'PENDING' ? <span className="small" style={{ color: '#a06a00', fontWeight: 700 }}>⏳ {t('Ждёт подтверждения оплаты салоном')}</span> : null}
          </span>
          {c.status === 'ACTIVE' && (
            <>
              <a className="btn" href={`/${slug}/c/${c.code}`} style={{ minHeight: 36, fontSize: 13, padding: '0 10px' }}>{t('Открыть')}</a>
              {c.mine && <button type="button" className="btn primary" onClick={() => share(c)} style={{ minHeight: 36, fontSize: 13, padding: '0 10px' }}>{t('Отправить')}</button>}
            </>
          )}
        </div>
      ))}
    </section>
  );
}
