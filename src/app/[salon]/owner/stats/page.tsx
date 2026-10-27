import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { ownerReport } from '@/server/reports';
import { formatSom, plural } from '@/lib/pricing';
import { utcToZoned } from '@/lib/time';
import { PeriodBar, readPeriod } from '../ui';

export const dynamic = 'force-dynamic';

/** Мастера и услуги: кто сколько принёс, средний чек, неявки, оценки; какие услуги приносят больше */
export default async function Stats({ params, searchParams }: { params: Promise<{ salon: string }>; searchParams: Promise<{ p?: string; at?: string }> }) {
  const { salon: slug } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const { kind, at } = readPeriod(await searchParams, salon.timezone);
  const r = await ownerReport(slug, kind, at);
  const today = utcToZoned(new Date(), salon.timezone).date;
  const ms = [...r.masters].filter((m) => m.visits > 0 || m.active).sort((a, b) => b.cash - a.cash);
  const maxCash = Math.max(1, ...ms.map((m) => m.cash));
  const totalCash = Math.max(1, r.revenue.cash);

  return (
    <main className="safe" style={{ padding: '24px 20px 32px', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PeriodBar title="Мастера и услуги" base={`/${slug}/owner/stats`} period={r.period} today={today} />

      <section className="card stack" style={{ gap: 12 }}>
        <strong>Мастера</strong>
        {ms.map((m) => (
          <div key={m.id} className="stack" style={{ gap: 4 }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
              <b>{m.name}</b><b>{formatSom(m.cash)}</b>
            </div>
            <span aria-hidden style={{ height: 8, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${(m.cash / maxCash) * 100}%`, background: 'var(--accent)' }} />
            </span>
            <span className="small muted">
              {m.visits} {plural(m.visits, 'визит', 'визита', 'визитов')} · средний чек {formatSom(m.avgCheck)} · {Math.round((m.cash / totalCash) * 100)}% выручки
              {m.noShows ? ` · не пришли: ${m.noShows}` : ''}
              {m.rating ? ` · ★ ${m.rating.avg.toFixed(1).replace('.', ',')} (${m.rating.count})` : ''}
            </span>
          </div>
        ))}
      </section>

      <section className="card stack" style={{ gap: 8 }}>
        <strong>Услуги — что приносит больше</strong>
        {!r.services.length ? <span className="muted">Оплат за этот период нет.</span> : (
          <div className="stack" style={{ gap: 0 }}>
            {r.services.map((x) => (
              <div key={x.name + x.category} className="row" style={{ justifyContent: 'space-between', gap: 10, borderTop: '1px solid var(--line)', padding: '8px 0' }}>
                <span style={{ minWidth: 0 }}>{x.name}<span className="small muted" style={{ display: 'block' }}>{x.category} · {x.count} {plural(x.count, 'раз', 'раза', 'раз')} · {Math.round((x.cash / totalCash) * 100)}% выручки</span></span>
                <b style={{ whiteSpace: 'nowrap' }}>{formatSom(x.cash)}</b>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card stack" style={{ gap: 6 }}>
        <strong>Клиенты</strong>
        <span>Пришли за период: <b>{r.revenue.clients}</b> — новых <b>{r.revenue.newClients}</b>, постоянных <b>{r.revenue.returning}</b></span>
        <span className="small muted">Новый — тот, чей первый оплаченный визит в салон пришёлся на этот период.</span>
      </section>
    </main>
  );
}
