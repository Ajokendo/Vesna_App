import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { ownerReport } from '@/server/reports';
import { formatSom, plural } from '@/lib/pricing';
import { dayMonthShort, utcToZoned } from '@/lib/time';
import { PeriodBar, readPeriod } from '../ui';

export const dynamic = 'force-dynamic';

/** Зарплатная ведомость: сколько каждому мастеру за период, с разбивкой по визитам и выгрузкой в Excel */
export default async function Payroll({ params, searchParams }: { params: Promise<{ salon: string }>; searchParams: Promise<{ p?: string; at?: string }> }) {
  const { salon: slug } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const { kind, at } = readPeriod(await searchParams, salon.timezone);
  const r = await ownerReport(slug, kind, at);
  const today = utcToZoned(new Date(), salon.timezone).date;
  const ms = r.masters.filter((m) => m.visits > 0 || m.active);
  const total = ms.reduce((n, m) => n + (m.isOwner ? 0 : m.master), 0);

  return (
    <main className="safe" style={{ padding: '24px 20px 32px', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PeriodBar title="Зарплата мастерам" base={`/${slug}/owner/pay`} period={r.period} today={today} />

      <section className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span>Всего к выплате: <b style={{ fontSize: 20 }}>{formatSom(total)}</b></span>
          <a href={`/api/${slug}/owner/payroll?p=${kind}&at=${at}`} className="btn" style={{ minHeight: 42, fontSize: 14 }} download>⬇ Скачать в Excel</a>
        </div>
        <div className="stack" style={{ gap: 0 }}>
          {ms.map((m) => (
            <div key={m.id} className="row" style={{ justifyContent: 'space-between', gap: 10, borderTop: '1px solid var(--line)', padding: '9px 0' }}>
              <div className="stack" style={{ gap: 1, minWidth: 0 }}>
                <b>{m.name}{m.isOwner && <span className="small muted" style={{ fontWeight: 400 }}> · хозяйка</span>}{!m.active && <span className="small muted" style={{ fontWeight: 400 }}> · не работает</span>}</b>
                <span className="small muted">{m.visits} {plural(m.visits, 'визит', 'визита', 'визитов')} · получено {formatSom(m.cash)}{m.isOwner ? '' : ` · ${m.percent}%`}</span>
              </div>
              <b style={{ fontSize: 17, whiteSpace: 'nowrap' }}>{m.isOwner ? <span className="small muted">всё салону</span> : formatSom(m.master)}</b>
            </div>
          ))}
        </div>
        <span className="small muted" style={{ lineHeight: 1.45 }}>Доля считается с суммы, оплаченной деньгами: если клиент платил баллами, скидку делят салон и мастер поровну. Процент мастера меняется в «Настройках» → «Мастера».</span>
      </section>

      {ms.filter((m) => m.lines.length).map((m) => (
        <details key={m.id} className="card">
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{m.name}: визиты по дням ({m.visits})</summary>
          <div className="stack" style={{ gap: 0, marginTop: 8 }}>
            {m.lines.map((l, i) => (
              <div key={i} className="row" style={{ justifyContent: 'space-between', gap: 10, borderTop: '1px solid var(--line)', padding: '7px 0', fontSize: 14 }}>
                <span style={{ minWidth: 0 }}><span className="muted">{dayMonthShort(l.date)}</span> · {l.service}
                  <span className="small muted" style={{ display: 'block' }}>цена {formatSom(l.price)}{l.points ? ` · баллами ${l.points}` : ''} · деньгами {formatSom(l.cash)}</span>
                </span>
                <b style={{ whiteSpace: 'nowrap' }}>{m.isOwner ? '' : formatSom(l.share)}</b>
              </div>
            ))}
          </div>
        </details>
      ))}
    </main>
  );
}
