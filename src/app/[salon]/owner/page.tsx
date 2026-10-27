import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { ownerReport } from '@/server/reports';
import { formatSom } from '@/lib/pricing';
import { utcToZoned } from '@/lib/time';
import { PeriodBar, Stat, grid, readPeriod } from './ui';
import OwnerAccount from './OwnerAccount';

export const dynamic = 'force-dynamic';

/** Выручка за период: деньги, визиты, средний чек, способы оплаты, график и сравнение с прошлым периодом */
export default async function Revenue({ params, searchParams }: { params: Promise<{ salon: string }>; searchParams: Promise<{ p?: string; at?: string }> }) {
  const { salon: slug } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const { kind, at } = readPeriod(await searchParams, salon.timezone);
  const r = await ownerReport(slug, kind, at);
  const v = r.revenue;
  const max = Math.max(1, ...v.series.map((x) => x.cash));
  const today = utcToZoned(new Date(), salon.timezone).date;
  const prevName = { day: 'вчера', week: 'прошлая неделя', month: 'прошлый месяц', year: 'прошлый год' }[kind];

  return (
    <main className="safe" style={{ padding: '24px 20px 32px', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PeriodBar title="Выручка" base={`/${slug}/owner`} period={r.period} today={today} />

      <div style={grid}>
        <Stat label="Выручка (деньгами)" now={v.cash} before={r.prev.cash} />
        <Stat label="Салону после мастеров" now={v.salon} before={r.prev.salon} />
        <Stat label="Визитов" now={v.visits} before={r.prev.visits} money={false} />
        <Stat label="Средний чек" now={v.avgCheck} before={r.prev.avgCheck} />
      </div>
      <p className="small muted" style={{ margin: 0 }}>Сравнение: {prevName} — выручка {formatSom(r.prev.cash)}, визитов {r.prev.visits}.</p>

      {v.series.length > 0 && (
        <section className="card stack" style={{ gap: 10 }} aria-label="Выручка по дням">
          <strong>{kind === 'year' ? 'По месяцам' : 'По дням'}</strong>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: kind === 'month' ? 2 : 6, height: 150, overflowX: 'auto' }}>
            {v.series.map((x) => (
              <Link key={x.from} href={`/${slug}/owner?p=${kind === 'year' ? 'month' : 'day'}&at=${x.from}`} title={`${x.label}: ${formatSom(x.cash)}, визитов ${x.visits}`}
                style={{ flex: '1 0 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 3, textDecoration: 'none', color: 'var(--muted)' }}>
                <span aria-hidden style={{ width: '100%', maxWidth: 34, height: `${Math.max(x.cash ? 3 : 1, (x.cash / max) * 120)}px`, background: x.cash ? 'var(--accent)' : 'var(--line)', borderRadius: '4px 4px 0 0' }} />
                <span style={{ fontSize: 10, lineHeight: 1 }}>{x.label}</span>
              </Link>
            ))}
          </div>
          <span className="small muted">Нажмите на столбик, чтобы открыть этот {kind === 'year' ? 'месяц' : 'день'}.</span>
        </section>
      )}

      <section className="card stack" style={{ gap: 8 }}>
        <strong>Как получены деньги</strong>
        {v.methods.length ? v.methods.map((m) => (
          <div key={m.method} className="row" style={{ justifyContent: 'space-between' }}><span>{m.method}</span><b>{formatSom(m.amount)}</b></div>
        )) : <span className="muted">Оплат за этот период нет.</span>}
        <div className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 8 }}><span className="muted">Стоимость услуг по прайсу</span><span>{formatSom(v.price)}</span></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Оплачено баллами (скидка)</span><span>{v.points ? `−${formatSom(v.points)}` : '—'}</span></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Мастерам</span><span>{formatSom(v.master)}</span></div>
      </section>

      <div style={grid}>
        <Stat label="Клиентов" now={v.clients} money={false} hint={`новых ${v.newClients} · постоянных ${v.returning}`} />
        <Stat label="Не пришли" now={v.noShows} money={false} hint={`отменили запись: ${v.cancelled}`} />
        <Stat label="Прибыль" now={r.profit} before={r.prevProfit} hint="после мастеров и расходов — подробно в «Расходах»" />
      </div>
      <OwnerAccount slug={slug} />
    </main>
  );
}
