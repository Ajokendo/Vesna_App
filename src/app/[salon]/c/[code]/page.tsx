import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CERT_STATUS, findCertificate } from '@/server/certificates';
import { qrSvg, siteOrigin } from '@/server/qr';
import { formatSom } from '@/lib/pricing';
import { dayMonth, utcToZoned } from '@/lib/time';
import PrintButton from '../../admin/qr/PrintButton';
import { getT } from '@/server/lang';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Подарочный сертификат' };

/** Подарочный сертификат по ссылке: красиво на экране и для печати. Код — для оплаты в салоне */
export default async function Certificate({ params }: { params: Promise<{ salon: string; code: string }> }) {
  const { salon: slug, code } = await params;
  const { salon, cert } = await findCertificate(slug, decodeURIComponent(code)).catch(() => ({ salon: null, cert: null }));
  if (!salon || !cert) notFound();
  const exp = utcToZoned(cert.expiresAt, salon.timezone).date;
  const { t, lang } = await getT(slug);
  const qr = await qrSvg(`${await siteOrigin()}/${slug}/c/${cert.code}`);
  const used = cert.balance !== cert.amount;
  return (
    <main className="safe" style={{ minHeight: '100dvh', padding: '20px 16px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <article className="cert" style={{
        width: 'min(100%, 480px)', borderRadius: 24, padding: '28px 22px', textAlign: 'center', position: 'relative',
        background: 'linear-gradient(160deg,#ffffff 0%,#f7f1e3 60%,#eef3ea 100%)', border: '2px solid var(--gold)',
        boxShadow: '0 0 0 6px #fff, 0 0 0 7.5px var(--gold), 0 18px 40px rgba(40,50,30,.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {salon.logoUrl && <img src={salon.logoUrl} alt="" width={96} height={96} style={{ borderRadius: '50%' }} />}
        <div style={{ fontFamily: 'var(--serif)', fontSize: 15, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--accent-dark)' }}>{t('Подарочный сертификат')}</div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 52, fontWeight: 700, lineHeight: 1, color: 'var(--accent-dark)' }}>{formatSom(cert.amount)}</div>
        <div className="muted">{t('на любые услуги салона «{salon}»', { salon: salon.name })}</div>
        {(cert.toName || cert.fromName) && (
          <div style={{ fontSize: 17, lineHeight: 1.5 }}>
            {cert.toName && <div>{t('Для')}: <b>{cert.toName}</b></div>}
            {cert.fromName && <div>{t('От')}: <b>{cert.fromName}</b></div>}
          </div>
        )}
        <div style={{ width: 60, height: 1, background: 'var(--gold)', margin: '4px 0' }} />
        <div className="small muted">{t('Код сертификата')}</div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 26, fontWeight: 800, letterSpacing: 4 }}>{cert.code}</div>
        <div style={{ width: 120, height: 120 }} dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="small" style={{ lineHeight: 1.5 }}>
          {t('Действует до')} <b>{dayMonth(exp, lang)} {exp.slice(0, 4)}</b>
          {used && cert.status === 'ACTIVE' && <><br />{t('Осталось')}: <b>{formatSom(cert.balance)}</b> — {t('можно потратить за несколько визитов')}</>}
          {cert.status !== 'ACTIVE' && <><br /><b style={{ color: 'var(--danger)' }}>{t(CERT_STATUS[cert.status])}</b></>}
        </div>
        <div className="small muted" style={{ lineHeight: 1.45 }}>
          {[salon.city, salon.address].filter(Boolean).join(', ')}{salon.phone ? ` · ${salon.phone}` : ''}<br />
          {t('Назовите код администратору при оплате.')}
        </div>
      </article>
      <div className="no-print row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {cert.status === 'ACTIVE' && <Link href={`/${slug}/book`} className="btn primary">{t('Записаться')}</Link>}
        <PrintButton />
      </div>
      <style>{`.cert svg{width:100%;height:100%;display:block}
        @media print { @page { margin: 12mm } body { background: #fff !important } .no-print, nav { display: none !important } .cert { box-shadow: none !important; margin-top: 10mm } }`}</style>
    </main>
  );
}
