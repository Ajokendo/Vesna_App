import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { myPoints } from '@/server/me';
import { clientQrUrl, qrSvg, siteOrigin } from '@/server/qr';
import { dayMonthShort } from '@/lib/time';
import ClientNav from '@/app/ClientNav';
import NotYou from '../NotYou';
import InstallCard from '@/app/InstallCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Мои баллы' };

const KIND: Record<string, string> = { EARN: 'Начислено', REDEEM: 'Оплачено баллами', ADJUST: 'Подарок от салона' };

/** Баллы: сколько накоплено, как начисляются и тратятся, история */
export default async function Points({ params }: { params: Promise<{ salon: string }> }) {
  const { salon: slug } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const data = await myPoints(slug);
  const qr = data ? await qrSvg(clientQrUrl(await siteOrigin(), slug, data.id)) : null;
  return (
    <main className="app">
      <div className="page" style={{ gap: 16 }}>
        <h1 style={{ fontSize: 24 }}>Мои баллы</h1>
        {!data ? <NotYou slug={slug} whatsapp={salon.whatsapp} /> : (
          <>
            <section className="card" style={{ textAlign: 'center', background: 'linear-gradient(160deg,#eef3ea,#f7f1e3)', borderColor: 'var(--gold)' }}>
              <div className="small muted">{data.name}, на вашем счёте</div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 44, fontWeight: 700, color: 'var(--accent-dark)', lineHeight: 1.1 }}>{data.balance}</div>
              <div className="small muted">баллов · 1 балл = 1 сом</div>
              {data.minRedeem > 0 && data.balance < data.minRedeem ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ height: 10, borderRadius: 99, background: '#e3e8de', overflow: 'hidden' }} aria-hidden>
                    <div style={{ width: `${Math.round((data.balance / data.minRedeem) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,var(--accent),var(--gold))' }} />
                  </div>
                  <div className="small" style={{ marginTop: 6 }}><b>{data.balance} из {data.minRedeem}</b> — с {data.minRedeem} баллов ими можно оплачивать услуги</div>
                </div>
              ) : data.minRedeem > 0 ? <div className="small" style={{ marginTop: 8, color: 'var(--accent-dark)', fontWeight: 800 }}>Баллами уже можно оплачивать — скажите администратору</div> : null}
            </section>
            {!data.welcomeGot && <InstallCard bonus={data.welcomeBonus} />}
            {qr && (
              <details className="card" style={{ textAlign: 'center' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 800, listStyle: 'none' }}>Мой QR-код ▾</summary>
                <div style={{ width: 'min(240px, 70vw)', margin: '12px auto 6px' }} dangerouslySetInnerHTML={{ __html: qr }} />
                <span className="small muted">Покажите администратору — он сразу увидит вас и ваши баллы, даже если вы пришли без записи.</span>
              </details>
            )}
            <section className="stack small" style={{ gap: 6, lineHeight: 1.5 }}>
              <span>• После каждого визита начисляем <strong>{data.percent}%</strong> от суммы, оплаченной деньгами.</span>
              <span>• {data.minRedeem > 0 ? `Когда на счёте ${data.minRedeem} баллов и больше, ими` : 'Баллами'} можно оплатить всю услугу или её часть — скажите администратору при оплате.</span>
              <span>• Баллы за детей копятся на вашем счёте.</span>
            </section>
            <section className="stack" style={{ gap: 4 }}>
              <h2 style={{ fontSize: 18 }}>История</h2>
              {!data.history.length && <p className="muted small" style={{ margin: 0 }}>Пока пусто — баллы появятся после первого оплаченного визита.</p>}
              {data.history.map((h) => (
                <div key={h.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', padding: '8px 0', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{KIND[h.kind] ?? h.kind}</div>
                    <div className="small muted">{dayMonthShort(h.date)}{h.service ? ` · ${h.service}` : ''}{h.note ? ` · ${h.note}` : ''}</div>
                  </div>
                  <strong style={{ color: h.delta > 0 ? 'var(--accent-dark)' : 'var(--danger)', flex: '0 0 auto' }}>{h.delta > 0 ? `+${h.delta}` : h.delta}</strong>
                </div>
              ))}
            </section>
            <Link href={`/${slug}/book`} className="btn primary">Записаться</Link>
          </>
        )}
      </div>
      <ClientNav slug={slug} />
    </main>
  );
}
