import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { myPoints } from '@/server/me';
import { clientQrUrl, qrSvg, siteOrigin } from '@/server/qr';
import { dayMonthShort } from '@/lib/time';
import ClientNav from '@/app/ClientNav';
import NotYou from '../NotYou';
import InstallCard from '@/app/InstallCard';
import InviteCard from '@/app/InviteCard';
import BirthdayCard from '@/app/BirthdayCard';
import { getT } from '@/server/lang';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Мои баллы' };

const KIND: Record<string, string> = { EARN: 'Начислено', REDEEM: 'Оплачено баллами', ADJUST: 'Подарок от салона' };

/** Баллы: сколько накоплено, как начисляются и тратятся, история */
export default async function Points({ params }: { params: Promise<{ salon: string }> }) {
  const { salon: slug } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const { t, lang } = await getT();
  const data = await myPoints(slug);
  const qr = data ? await qrSvg(clientQrUrl(await siteOrigin(), slug, data.id)) : null;
  return (
    <main className="app home">
      <div className="page" style={{ gap: 16, flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <h1 style={{ fontSize: 24 }}>{t('Мои баллы')}</h1>
        {!data ? <NotYou slug={slug} whatsapp={salon.whatsapp} /> : (
          <>
            <section className="card" style={{ textAlign: 'center', background: 'linear-gradient(160deg,#eef3ea,#f7f1e3)', borderColor: 'var(--gold)' }}>
              <div className="small muted">{data.name}, {t('на вашем счёте')}</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 44, fontWeight: 700, color: 'var(--accent-dark)', lineHeight: 1.1 }}>{data.balance}</div>
              <div className="small muted">{t('баллов · 1 балл = 1 сом')}</div>
              {data.minRedeem > 0 && data.balance < data.minRedeem ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ height: 10, borderRadius: 99, background: '#e3e8de', overflow: 'hidden' }} aria-hidden>
                    <div style={{ width: `${Math.round((data.balance / data.minRedeem) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,var(--accent),var(--gold))' }} />
                  </div>
                  <div className="small" style={{ marginTop: 6 }}>{t('{a} из {b}', { a: data.balance, b: data.minRedeem })} — {t('с {n} баллов ими можно оплачивать услуги', { n: data.minRedeem })}</div>
                </div>
              ) : data.minRedeem > 0 ? <div className="small" style={{ marginTop: 8, color: 'var(--accent-dark)', fontWeight: 800 }}>{t('Баллами уже можно оплачивать — скажите администратору')}</div> : null}
            </section>
            {!data.welcomeGot && <InstallCard bonus={data.welcomeBonus} />}
            {salon.birthdayGreet && !data.birthDate && <BirthdayCard slug={slug} bonus={salon.birthdayBonus} />}
            {data.referralCode && <InviteCard slug={slug} salonName={salon.name} code={data.referralCode} bonus={data.referralBonus} invited={data.invited} />}
            {qr && (
              <details className="card" style={{ textAlign: 'center' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 800, listStyle: 'none' }}>{t('Мой QR-код')} ▾</summary>
                <div style={{ width: 'min(240px, 70vw)', margin: '12px auto 6px' }} dangerouslySetInnerHTML={{ __html: qr }} />
                <span className="small muted">{t('Покажите администратору — он сразу увидит вас и ваши баллы, даже если вы пришли без записи.')}</span>
              </details>
            )}
            <section className="stack small" style={{ gap: 6, lineHeight: 1.5 }}>
              <span>• {t('После каждого визита начисляем {p}% от суммы, оплаченной деньгами.', { p: data.percent })}</span>
              <span>• {data.minRedeem > 0 ? t('Когда на счёте {n} баллов и больше, ими можно оплатить всю услугу или её часть — скажите администратору при оплате.', { n: data.minRedeem }) : t('Баллами можно оплатить всю услугу или её часть — скажите администратору при оплате.')}</span>
              <span>• {t('Баллы за детей копятся на вашем счёте.')}</span>
              {data.referralBonus > 0 && <span>• {t('За каждого приглашённого друга — {n} баллов, когда он оплатит первый визит.', { n: data.referralBonus })}</span>}
            </section>
            <section className="stack" style={{ gap: 4 }}>
              <h2 style={{ fontSize: 18 }}>{t('История')}</h2>
              {!data.history.length && <p className="muted small" style={{ margin: 0 }}>{t('Пока пусто — баллы появятся после первого оплаченного визита.')}</p>}
              {data.history.map((h) => (
                <div key={h.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '8px 0', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{t(KIND[h.kind] ?? h.kind)}</div>
                    <div className="small muted">{dayMonthShort(h.date, lang)}{h.service ? ` · ${h.service}` : ''}{h.note ? ` · ${h.note}` : ''}</div>
                  </div>
                  <strong style={{ color: h.delta > 0 ? 'var(--accent-dark)' : 'var(--danger)', flex: '0 0 auto' }}>{h.delta > 0 ? `+${h.delta}` : h.delta}</strong>
                </div>
              ))}
            </section>
            <Link href={`/${slug}/book`} className="btn primary">{t('Записаться')}</Link>
          </>
        )}
      </div>
      <ClientNav slug={slug} inline />
    </main>
  );
}
