import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCashReport, getCatalog, getJournal, getSalon } from '@/server/salon';
import { addDays, dayMonth, hhmm, utcToZoned, weekdayFull } from '@/lib/time';
import { formatSom } from '@/lib/pricing';
import NewAppointment from './NewAppointment';
import ApptCard from './ApptCard';

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
  const [{ columns }, catalog, cash] = await Promise.all([getJournal(slug, date), getCatalog(salon.id), getCashReport(slug, date)]);
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
        <nav className="row" aria-label="Дата" style={{ flexWrap: 'wrap' }}>
          <Link className="btn" href={`/${slug}/admin/staff`}>Мастера и PIN</Link>
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
              {c.items.map((a) => (
                <ApptCard key={a.id} a={a} top={(a.start - START) * PX} px={PX} slug={slug} earnPercent={salon.pointsPercent} masterPercent={c.masterPercent} />
              ))}
              {date === now.date && now.minute >= START && now.minute <= END && (
                <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: (now.minute - START) * PX, borderTop: '2px dashed #b23a5a' }} />
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Нажмите на запись, чтобы принять оплату. Белые — ожидаются, зелёные — оплачены, кремовые — без записи.
        Пунктир — выдержка краски: в это время мастер свободен и к нему можно записать другого клиента. Красная линия — текущее время.
      </p>

      <section className="card stack" style={{ gap: 12 }} aria-labelledby="cash-title">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h2 id="cash-title" style={{ fontSize: 20, margin: 0 }}>Касса за {dayMonth(date)}</h2>
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
                  <th style={{ padding: '6px 8px' }}>Мастеру</th>
                  <th style={{ padding: '6px 8px' }}>Салону</th>
                </tr>
              </thead>
              <tbody>
                {cash.masters.map((m) => (
                  <tr key={m.name} style={{ textAlign: 'right', borderTop: '1px solid var(--line)' }}>
                    <td style={{ textAlign: 'left', padding: '8px', fontWeight: 700 }}>{m.name}{m.isOwner ? <span className="small muted"> · хозяйка</span> : null}</td>
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
      </section>
    </main>
  );
}
