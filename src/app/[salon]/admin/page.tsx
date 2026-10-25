import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCatalog, getJournal, getSalon } from '@/server/salon';
import { addDays, dayMonth, hhmm, utcToZoned, weekdayFull } from '@/lib/time';
import { formatPrice } from '@/lib/pricing';
import NewAppointment from './NewAppointment';

export const dynamic = 'force-dynamic';

const GROUPS = [
  { id: 'hair', name: 'Парикмахеры' },
  { id: 'nails', name: 'Ногтевой сервис' },
  { id: 'brows', name: 'Брови и шугаринг' },
] as const;

const PX = 1.2; // пикселей на минуту

export default async function Journal({ params, searchParams }: {
  params: Promise<{ salon: string }>;
  searchParams: Promise<{ date?: string; group?: string }>;
}) {
  const { salon: slug } = await params;
  const sp = await searchParams;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const now = utcToZoned(new Date(), salon.timezone);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : now.date;
  const group = GROUPS.find((g) => g.id === sp.group)?.id ?? 'hair';
  const [{ columns }, catalog] = await Promise.all([getJournal(slug, date), getCatalog(salon.id)]);
  const cols = columns.filter((c) => c.group === group);

  const START = Math.min(9 * 60, ...cols.filter((c) => c.day).map((c) => c.day!.start));
  const END = Math.max(20 * 60, ...cols.filter((c) => c.day).map((c) => c.day!.end));
  const hours = Array.from({ length: Math.floor((END - START) / 60) + 1 }, (_, i) => START + i * 60).filter((m) => m % 60 === 0 || m === START);
  const total = columns.reduce((n, c) => n + c.items.length, 0);
  const link = (d: string, g: string = group) => `/${slug}/admin?date=${d}&group=${g}`;

  return (
    <main style={{ padding: '24px 28px 40px', display: 'flex', flexDirection: 'column', gap: 18, minHeight: '100dvh' }}>
      <header className="row" style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26 }}>Журнал записей</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>{weekdayFull(date)}, {dayMonth(date)} · записей: {total}</p>
        </div>
        <nav className="row" aria-label="Дата">
          <Link className="btn" href={link(addDays(date, -1))} aria-label="Предыдущий день">‹</Link>
          <Link className="btn" href={link(now.date)}>Сегодня</Link>
          <Link className="btn" href={link(addDays(date, 1))} aria-label="Следующий день">›</Link>
        </nav>
      </header>

      <div className="tabs" style={{ alignSelf: 'flex-start' }}>
        {GROUPS.map((g) => (
          <Link key={g.id} href={link(date, g.id)} aria-current={g.id === group ? 'page' : undefined}
            style={{ minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 18px', borderRadius: 12, fontWeight: 800, textDecoration: 'none', color: g.id === group ? 'var(--ink)' : 'var(--muted)', background: g.id === group ? '#fff' : 'transparent' }}>
            {g.name} · {columns.filter((c) => c.group === g.id).length}
          </Link>
        ))}
      </div>

      <NewAppointment slug={slug} date={date} catalog={catalog} />

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ minWidth: 220 * cols.length + 64, display: 'grid', gridTemplateColumns: `64px repeat(${cols.length}, minmax(220px, 1fr))` }}>
          <div style={{ borderBottom: '1px solid var(--line)' }} />
          {cols.map((c) => (
            <div key={c.id} className="row" style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', borderLeft: '1px solid var(--line)' }}>
              <span className="avatar" style={{ width: 40, height: 40, fontSize: 16 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.photoUrl ? <img src={c.photoUrl} alt="" /> : c.name[0]}
              </span>
              <span className="stack" style={{ gap: 0 }}>
                <strong>{c.name}</strong>
                <span className="small muted">{c.day ? `${hhmm(c.day.start)}–${hhmm(c.day.end)}` : 'Выходной'}</span>
              </span>
            </div>
          ))}

          <div style={{ position: 'relative', height: (END - START) * PX }}>
            {hours.map((m) => (
              <span key={m} className="small muted" style={{ position: 'absolute', right: 10, top: Math.max(2, (m - START) * PX - 8), fontWeight: 700 }}>{hhmm(m)}</span>
            ))}
          </div>
          {cols.map((c) => (
            <div key={c.id} style={{
              position: 'relative', height: (END - START) * PX, borderLeft: '1px solid var(--line)',
              background: `repeating-linear-gradient(to bottom, #dde5de 0 1px, transparent 1px ${60 * PX}px), repeating-linear-gradient(to bottom, #f1f4f0 0 1px, transparent 1px ${15 * PX}px)`,
            }}>
              {!c.day && (
                <div style={{ position: 'absolute', inset: 8, borderRadius: 14, background: 'repeating-linear-gradient(135deg,#eceee8 0 10px,#f6f8f5 10px 20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 16, fontWeight: 700, color: 'var(--muted)' }}>
                  Выходной по графику<br />{c.scheduleLabel}
                </div>
              )}
              {c.day && c.day.start > START && <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: (c.day.start - START) * PX, background: '#f3f4f0' }} />}
              {c.day && c.day.end < END && <div style={{ position: 'absolute', left: 0, right: 0, top: (c.day.end - START) * PX, bottom: 0, background: '#f3f4f0' }} />}
              {c.items.map((a) => {
                const h = (a.end - a.start) * PX;
                const walk = a.source === 'WALK_IN';
                return (
                  <div key={a.id} title={`${hhmm(a.start)}–${hhmm(a.end)} ${a.client}: ${a.service}`} style={{
                    position: 'absolute', left: 6, right: 6, top: (a.start - START) * PX + 1, height: h - 2, borderRadius: 10, padding: h >= 34 ? '5px 10px' : '2px 10px', overflow: 'hidden',
                    background: a.paid ? 'var(--accent-soft)' : walk ? 'var(--cream)' : '#fff', border: `1px solid ${a.paid ? '#a9bc9c' : walk ? 'var(--gold)' : '#b9c7bc'}`, fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hhmm(a.start)} {a.client}</div>
                    {h >= 34 && <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.service}{a.addons.length ? ` + ${a.addons.join(', ').toLowerCase()}` : ''} · {formatPrice(a.price, a.priceMax)}</div>}
                  </div>
                );
              })}
              {date === now.date && now.minute >= START && now.minute <= END && (
                <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: (now.minute - START) * PX, borderTop: '2px dashed #b23a5a' }} />
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Сетка — 5 минут. Белые — ожидаются, зелёные — оплачены, кремовые — без записи. Красная линия — текущее время.</p>
    </main>
  );
}
