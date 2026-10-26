import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { myPoints } from '@/server/me';
import { dayMonthShort } from '@/lib/time';
import ClientNav from '@/app/ClientNav';
import NotYou from '../NotYou';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Мои баллы' };

const KIND: Record<string, string> = { EARN: 'Начислено', REDEEM: 'Оплачено баллами', ADJUST: 'Подарок от салона' };

/** Баллы: сколько накоплено, как начисляются и тратятся, история */
export default async function Points({ params }: { params: Promise<{ salon: string }> }) {
  const { salon: slug } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const data = await myPoints(slug);
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
            </section>
            <section className="stack small" style={{ gap: 6, lineHeight: 1.5 }}>
              <span>• После каждого визита начисляем <strong>{data.percent}%</strong> от суммы, оплаченной деньгами.</span>
              <span>• Баллами можно оплатить всю услугу или её часть — скажите администратору при оплате.</span>
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
