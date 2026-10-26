import Link from 'next/link';
import { getDayCounts } from '@/server/salon';
import { addDays, daysBetween, dayMonth, weekdayFull, weekdayShort, type DateStr } from '@/lib/time';

/**
 * Полоска из 7 дней с числом записей под датой (как в кабинете мастера).
 * ‹ › листают по неделе; «Вернуться к сегодня» — только если выбран другой день.
 */
export default async function DayStrip({ salon, date, today, href, note }: {
  salon: { id: string; timezone: string }; date: DateStr; today: DateStr; href: (d: DateStr) => string; note?: string;
}) {
  const off = daysBetween(today, date);
  const from = off >= 0 && off < 7 ? today : addDays(today, Math.floor(off / 7) * 7);
  const strip = await getDayCounts(salon, from, 7);
  return (
    <section className="stack" style={{ gap: 10, maxWidth: 640 }}>
      <div className="row" style={{ gap: 6, alignItems: 'stretch' }}>
        <Link className="btn" href={href(addDays(from, -7))} aria-label="Предыдущая неделя" style={{ minHeight: 'auto', padding: '0 8px', fontSize: 20 }}>‹</Link>
        <nav className="grid7" aria-label="Дни" style={{ flex: 1 }}>
          {strip.map((d) => {
            const on = d.date === date;
            const isToday = d.date === today;
            return (
              <Link key={d.date} href={href(d.date)} aria-current={on ? 'date' : undefined} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 0', borderRadius: 12, textDecoration: 'none',
                background: on ? 'var(--accent)' : '#fff', color: on ? '#fff' : 'var(--ink)',
                border: `${isToday && !on ? 2 : 1}px solid ${on || isToday ? 'var(--accent)' : 'var(--line)'}`,
              }}>
                <span className="small" style={{ fontWeight: 700, color: 'inherit' }}>{isToday ? 'сег.' : weekdayShort(d.date)}</span>
                <strong style={{ fontSize: 16 }}>{Number(d.date.slice(8))}</strong>
                <span style={{ fontSize: 12, fontWeight: 800 }} title="записей">{d.count || '—'}</span>
              </Link>
            );
          })}
        </nav>
        <Link className="btn" href={href(addDays(from, 7))} aria-label="Следующая неделя" style={{ minHeight: 'auto', padding: '0 8px', fontSize: 20 }}>›</Link>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>{date === today ? 'Сегодня' : weekdayFull(date)}, {dayMonth(date)}</h2>
          {note && <span className="small muted">{note}</span>}
        </div>
        {date !== today && <Link className="btn" style={{ minHeight: 40, fontSize: 14 }} href={href(today)}>← Вернуться к сегодня</Link>}
      </div>
    </section>
  );
}
