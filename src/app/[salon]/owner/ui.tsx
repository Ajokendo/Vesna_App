import Link from 'next/link';
import { PERIODS, change, type Period, type PeriodKind } from '@/lib/period';
import { formatSom } from '@/lib/pricing';
import { utcToZoned } from '@/lib/time';

/** Период из адреса страницы: ?p=month&at=2026-10-27 (по умолчанию — текущий месяц) */
export function readPeriod(sp: { p?: string; at?: string }, timezone: string): { kind: PeriodKind; at: string } {
  const kind = (PERIODS.find((x) => x.id === sp.p)?.id ?? 'month') as PeriodKind;
  const at = sp.at && /^\d{4}-\d{2}-\d{2}$/.test(sp.at) ? sp.at : utcToZoned(new Date(), timezone).date;
  return { kind, at };
}

/** Заголовок раздела и выбор периода: День · Неделя · Месяц · Год и стрелки ‹ › */
export function PeriodBar({ title, base, period, today }: { title: string; base: string; period: Period; today: string }) {
  const href = (p: PeriodKind, at: string) => `${base}?p=${p}&at=${at}`;
  const isNow = today >= period.from && today < period.to;
  const arrow = { minHeight: 42, minWidth: 46, padding: 0, fontSize: 20 } as const;
  return (
    <header className="stack" style={{ gap: 10 }}>
      <h1 style={{ fontSize: 26 }}>{title}</h1>
      <nav className="tabs" style={{ maxWidth: 480 }} aria-label="Период">
        {PERIODS.map((x) => (
          <Link key={x.id} href={href(x.id, period.at)} aria-current={x.id === period.kind ? 'page' : undefined}
            style={{ minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12, fontWeight: 800, fontSize: 14, textDecoration: 'none', color: x.id === period.kind ? 'var(--ink)' : 'var(--muted)', background: x.id === period.kind ? '#fff' : 'transparent' }}>
            {x.name}
          </Link>
        ))}
      </nav>
      <div className="row" style={{ gap: 8, maxWidth: 480 }}>
        <Link href={href(period.kind, period.prev)} className="btn" style={arrow} aria-label="Предыдущий период">‹</Link>
        <strong className="grow" style={{ textAlign: 'center', fontSize: 17 }}>{period.label}</strong>
        <Link href={href(period.kind, period.next)} className="btn" style={arrow} aria-label="Следующий период">›</Link>
      </div>
      {!isNow && <Link href={href(period.kind, today)} className="small" style={{ alignSelf: 'flex-start' }}>← к текущему периоду</Link>}
    </header>
  );
}

/** Плитка с цифрой и сравнением с прошлым периодом */
export function Stat({ label, value, now, before, money = true, invert, hint }: {
  label: string; value?: string; now: number; before?: number; money?: boolean; invert?: boolean; hint?: string;
}) {
  const ch = before === undefined ? null : change(now, before);
  const good = ch === null ? null : invert ? ch < 0 : ch > 0;
  return (
    <div className="card stack" style={{ gap: 2, padding: '12px 14px' }}>
      <span className="small muted">{label}</span>
      <strong style={{ fontSize: 22, lineHeight: 1.2 }}>{value ?? (money ? formatSom(now) : String(now))}</strong>
      {ch !== null && ch !== 0 && (
        <span className="small" style={{ color: good ? 'var(--accent-dark)' : 'var(--danger)', fontWeight: 700 }}>
          {ch > 0 ? '▲' : '▼'} {Math.abs(ch)}% к прошлому периоду
        </span>
      )}
      {ch === 0 && <span className="small muted">как в прошлом периоде</span>}
      {hint && <span className="small muted" style={{ lineHeight: 1.35 }}>{hint}</span>}
    </div>
  );
}

export const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 } as const;
export const th = { padding: '6px 8px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 } as const;
export const td = { padding: '8px' } as const;
