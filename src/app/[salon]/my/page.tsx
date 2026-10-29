import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { myVisits } from '@/server/me';
import { dayMonth, dayMonthShort, hhmm, utcToZoned, weekdayFull } from '@/lib/time';
import { formatPrice, formatSom } from '@/lib/pricing';
import ClientNav from '@/app/ClientNav';
import NotYou from '../NotYou';
import InstallCard from '@/app/InstallCard';
import { myWaitlist } from '@/server/waitlist';
import WaitItem from './WaitItem';
import PushOptIn from '@/app/PushOptIn';
import { getT } from '@/server/lang';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Мои записи' };

/** Мои записи: ближайшие визиты (подтвердить, опоздаю, не приду) и история */
export default async function MyVisits({ params }: { params: Promise<{ salon: string }> }) {
  const { salon: slug } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const { t, lang } = await getT();
  const [data, waiting] = await Promise.all([myVisits(slug), myWaitlist(slug)]);
  const today = utcToZoned(new Date(), salon.timezone).date;
  return (
    <main className="app home">
      <div className="page" style={{ gap: 16, flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <h1 style={{ fontSize: 24 }}>{t('Мои записи')}</h1>
        <InstallCard bonus={data?.me.welcomeGot ? 0 : salon.welcomeBonus} compact />
        {!data ? <NotYou slug={slug} whatsapp={salon.whatsapp} /> : (
          <>
            <section className="stack" style={{ gap: 10 }}>
              {!data.upcoming.length && (
                <div className="card stack" style={{ gap: 10 }}>
                  <span className="muted">{t('Ближайших записей нет.')}</span>
                  <Link href={`/${slug}/book`} className="btn primary">{t('Записаться')}</Link>
                </div>
              )}
              {data.upcoming.map((v) => (
                <Link key={v.id} href={`/${slug}/v/${v.id}?t=${v.token}`} className="card row" style={{ gap: 12, textDecoration: 'none', color: 'inherit', alignItems: 'flex-start' }}>
                  <span className="avatar" style={{ width: 48, height: 48 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {v.staffPhoto ? <img src={v.staffPhoto} alt="" /> : v.staff[0]}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }} className="stack">
                    <strong style={{ fontSize: 17 }}>{v.date === today ? t('Сегодня') : `${weekdayFull(v.date, lang)}, ${dayMonth(v.date, lang)}`}, {hhmm(v.start)}</strong>
                    <span className="small">{v.service} · {v.staff}</span>
                    {v.forWhom && <span className="small muted">{t('Для')}: {v.forWhom}</span>}
                    <span className="small muted">{formatPrice(v.price, v.priceMax)}{v.confirmed ? ` · ${t('вы подтвердили')}` : ''}</span>
                    <span className="small" style={{ color: 'var(--accent-dark)', fontWeight: 800 }}>{t('Подробнее, опоздаю, не смогу прийти')} ›</span>
                  </span>
                </Link>
              ))}
            </section>
            {waiting.length > 0 && (
              <section className="stack" style={{ gap: 6 }}>
                <h2 style={{ fontSize: 18 }}>{t('Лист ожидания')}</h2>
                <span className="small muted">{t('Сообщим, если в этот день освободится время.')}</span>
                {waiting.map((w) => <WaitItem key={w.id} slug={slug} id={w.id} title={`${weekdayFull(w.date, lang)}, ${dayMonth(w.date, lang)}`} sub={w.title} notified={w.notified} />)}
                <PushOptIn slug={slug} compact />
              </section>
            )}
            {data.past.length > 0 && (
              <section className="stack" style={{ gap: 4 }}>
                <h2 style={{ fontSize: 18 }}>{t('Были у нас')}</h2>
                {data.past.map((v) => (
                  <div key={v.id} className="row" style={{ justifyContent: 'space-between', gap: 10, borderBottom: '1px solid var(--line)', padding: '8px 0', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{dayMonthShort(v.date, lang)} · {v.service}</div>
                      <div className="small muted">{v.staff}{v.forWhom ? ` · ${t('для')}: ${v.forWhom}` : ''}</div>
                      {v.canRate && <Link href={`/${slug}/v/${v.id}?t=${v.token}`} className="small" style={{ color: '#B7860F', fontWeight: 800 }}>★ {t('Оценить визит')}</Link>}
                    </div>
                    <span className="small" style={{ flex: '0 0 auto', fontWeight: 700, color: v.paid ? 'var(--ink)' : 'var(--muted)' }}>
                      {v.paid ? formatSom(v.price) : v.status === 'CANCELLED' ? t('отменена') : v.status === 'NO_SHOW' ? t('не пришли') : '—'}
                    </span>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
      <ClientNav slug={slug} inline />
    </main>
  );
}
