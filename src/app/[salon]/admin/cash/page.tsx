import { notFound } from 'next/navigation';
import { getCashReport, getSalon } from '@/server/salon';
import { dayMonth, utcToZoned } from '@/lib/time';
import { formatSom } from '@/lib/pricing';
import DayStrip from '../DayStrip';
import Tip from '@/app/Tip';

export const dynamic = 'force-dynamic';

/** Касса за день: сколько получено, сколько мастерам и салону */
export default async function Cash({ params, searchParams }: { params: Promise<{ salon: string }>; searchParams: Promise<{ date?: string }> }) {
  const { salon: slug } = await params;
  const sp = await searchParams;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const now = utcToZoned(new Date(), salon.timezone);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : now.date;
  const cash = await getCashReport(slug, date);
  return (
    <main className="safe" style={{ padding: '24px 28px 40px', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h1 style={{ fontSize: 26 }}>Касса</h1>
      <DayStrip salon={salon} date={date} today={now.date} href={(d) => `/${slug}/admin/cash?date=${d}`} note="под датой — число записей в этот день" />
      <section className="card stack" style={{ gap: 12 }} aria-labelledby="cash-title">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2 id="cash-title" style={{ fontSize: 20, margin: 0 }}>Итоги за {dayMonth(date)}</h2>
          <span className="small muted">Доля мастера считается с суммы, оплаченной деньгами: баллы — скидка, её делят салон и мастер поровну.</span>
        </div>
        {cash.masters.length === 0 ? <p className="muted" style={{ margin: 0 }}>Оплат за этот день пока нет.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 620 }}>
              <thead>
                <tr style={{ textAlign: 'right', color: 'var(--muted)', fontSize: 12 }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Мастер</th>
                  <th style={{ padding: '6px 8px' }}>Визитов</th>
                  <th style={{ padding: '6px 8px' }}>Стоимость услуг</th>
                  <th style={{ padding: '6px 8px' }}>Списано баллами</th>
                  <th style={{ padding: '6px 8px' }}>Получено деньгами</th>
                  <th style={{ padding: '6px 8px' }}>Мастеру <Tip slug={slug} help="cash" align="right" text="Доля мастера считается с суммы, оплаченной деньгами (и сертификатом). Баллы — скидка, её делят поровну. Краска и материалы целиком салону." /></th>
                  <th style={{ padding: '6px 8px' }}>Салону</th>
                </tr>
              </thead>
              <tbody>
                {cash.masters.map((m) => (
                  <tr key={m.name} style={{ textAlign: 'right', borderTop: '1px solid var(--line)' }}>
                    <td style={{ textAlign: 'left', padding: '8px', fontWeight: 700 }}>{m.name}{m.isOwner ? <span className="small muted"> · директор</span> : null}</td>
                    <td style={{ padding: '8px' }}>{m.visits}</td>
                    <td style={{ padding: '8px' }}>{formatSom(m.price)}</td>
                    <td style={{ padding: '8px' }}>{m.points ? `−${m.points}` : '—'}</td>
                    <td style={{ padding: '8px' }}>{formatSom(m.cash)}</td>
                    <td style={{ padding: '8px', fontWeight: 800 }}>{m.isOwner ? '—' : formatSom(m.master)}</td>
                    <td style={{ padding: '8px' }}>{formatSom(m.salon)}</td>
                  </tr>
                ))}
                <tr style={{ textAlign: 'right', borderTop: '2px solid var(--ink)', fontWeight: 800 }}>
                  <td style={{ textAlign: 'left', padding: '8px' }}>Итого</td>
                  <td style={{ padding: '8px' }}>{cash.total.visits}</td>
                  <td style={{ padding: '8px' }}>{formatSom(cash.total.price)}</td>
                  <td style={{ padding: '8px' }}>{cash.total.points ? `−${cash.total.points}` : '—'}</td>
                  <td style={{ padding: '8px' }}>{formatSom(cash.total.cash)}</td>
                  <td style={{ padding: '8px' }}>{formatSom(cash.total.master)}</td>
                  <td style={{ padding: '8px' }}>{formatSom(cash.total.salon)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {cash.methods.length > 0 && (
          <p className="small muted" style={{ margin: 0 }}>Деньгами: {cash.methods.map((m) => `${m.method.toLowerCase()} ${formatSom(m.amount)}`).join(' · ')}</p>
        )}
        {cash.total.cert > 0 && (
          <p className="small muted" style={{ margin: 0 }}>Оплачено подарочными сертификатами: {formatSom(cash.total.cert)} — эти деньги салон получил при продаже сертификатов; доля мастера с них считается.</p>
        )}
      </section>
      {cash.certificates.count > 0 && (
        <section className="card stack" style={{ gap: 6, borderColor: 'var(--gold)' }}>
          <strong>🎁 Продано сертификатов: {cash.certificates.count} на {formatSom(cash.certificates.amount)}</strong>
          <span className="small muted">{cash.certificates.methods.map((m) => `${m.method.toLowerCase()} ${formatSom(m.amount)}`).join(' · ')}</span>
          {cash.certificates.items.map((c) => <span key={c.code} className="small">{c.code} · {formatSom(c.amount)}{c.toName ? ` · для ${c.toName}` : ''}</span>)}
        </section>
      )}
    </main>
  );
}
