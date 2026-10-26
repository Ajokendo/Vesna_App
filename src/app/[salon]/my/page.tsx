import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { myVisits } from '@/server/me';
import { dayMonth, dayMonthShort, hhmm, utcToZoned, weekdayFull } from '@/lib/time';
import { formatPrice, formatSom } from '@/lib/pricing';
import ClientNav from '@/app/ClientNav';
import NotYou from '../NotYou';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Мои записи' };

/** Мои записи: ближайшие визиты (подтвердить, опоздаю, не приду) и история */
export default async function MyVisits({ params }: { params: Promise<{ salon: string }> }) {
  const { salon: slug } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const data = await myVisits(slug);
  const today = utcToZoned(new Date(), salon.timezone).date;
  return (
    <main className="app">
      <div className="page" style={{ gap: 16 }}>
        <h1 style={{ fontSize: 24 }}>Мои записи</h1>
        {!data ? <NotYou slug={slug} whatsapp={salon.whatsapp} /> : (
          <>
            <section className="stack" style={{ gap: 10 }}>
              {!data.upcoming.length && (
                <div className="card stack" style={{ gap: 10 }}>
                  <span className="muted">Ближайших записей нет.</span>
                  <Link href={`/${slug}/book`} className="btn primary">Записаться</Link>
                </div>
              )}
              {data.upcoming.map((v) => (
                <Link key={v.id} href={`/${slug}/v/${v.id}?t=${v.token}`} className="card row" style={{ gap: 12, textDecoration: 'none', color: 'inherit', alignItems: 'flex-start' }}>
                  <span className="avatar" style={{ width: 48, height: 48 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {v.staffPhoto ? <img src={v.staffPhoto} alt="" /> : v.staff[0]}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }} className="stack">
                    <strong style={{ fontSize: 17 }}>{v.date === today ? 'Сегодня' : `${weekdayFull(v.date)}, ${dayMonth(v.date)}`}, {hhmm(v.start)}</strong>
                    <span className="small">{v.service} · {v.staff}</span>
                    {v.forWhom && <span className="small muted">Для: {v.forWhom}</span>}
                    <span className="small muted">{formatPrice(v.price, v.priceMax)}{v.confirmed ? ' · вы подтвердили' : ''}</span>
                    <span className="small" style={{ color: 'var(--accent-dark)', fontWeight: 800 }}>Подробнее, опоздаю, не смогу прийти ›</span>
                  </span>
                </Link>
              ))}
            </section>
            {data.past.length > 0 && (
              <section className="stack" style={{ gap: 4 }}>
                <h2 style={{ fontSize: 18 }}>Были у нас</h2>
                {data.past.map((v) => (
                  <div key={v.id} className="row" style={{ justifyContent: 'space-between', gap: 10, borderBottom: '1px solid var(--line)', padding: '8px 0', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{dayMonthShort(v.date)} · {v.service}</div>
                      <div className="small muted">{v.staff}{v.forWhom ? ` · для: ${v.forWhom}` : ''}</div>
                    </div>
                    <span className="small" style={{ flex: '0 0 auto', fontWeight: 700, color: v.paid ? 'var(--ink)' : 'var(--muted)' }}>
                      {v.paid ? formatSom(v.price) : v.status === 'CANCELLED' ? 'отменена' : v.status === 'NO_SHOW' ? 'не пришли' : '—'}
                    </span>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
      <ClientNav slug={slug} />
    </main>
  );
}
