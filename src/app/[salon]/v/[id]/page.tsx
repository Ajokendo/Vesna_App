import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { checkId } from '@/server/push';
import { dayMonth, hhmm, utcToZoned, weekdayFull } from '@/lib/time';
import { formatPrice, formatSom } from '@/lib/pricing';
import PushOptIn from '@/app/PushOptIn';
import ConfirmButton from './ConfirmButton';
import LateButtons from './LateButtons';
import ClaimMe from './ClaimMe';
import InstallCard from '@/app/InstallCard';
import RateVisit from './RateVisit';
import { getReview } from '@/server/reviews';
import ClientNav from '@/app/ClientNav';
import { mapLink } from '@/lib/map';
import { RescheduleButton } from '../../admin/Reschedule';
import { CLIENT_MOVE_HOURS } from '@/server/clients';
import { getT } from '@/server/lang';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Моя запись' };

/** Страница записи клиента — открывается из уведомления */
export default async function Visit({ params, searchParams }: { params: Promise<{ salon: string; id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { salon: slug, id } = await params;
  const { t = '' } = await searchParams;
  const { t: tr, lang } = await getT();
  if (!(await checkId(id, t))) notFound();
  const a = await db.query.appointments.findFirst({
    where: eq(s.appointments.id, id),
    with: { salon: true, staff: true, client: true, service: { with: { category: true } }, addons: { with: { addon: true } } },
  });
  if (!a || a.salon.slug !== slug) notFound();
  const review = a.paid ? await getReview(a.id) : null;
  const { date, minute } = utcToZoned(a.startsAt, a.salon.timezone);
  const end = utcToZoned(a.endsAt, a.salon.timezone).minute;
  const cancelled = a.status === 'CANCELLED';
  const wa = a.salon.whatsapp?.replace(/\D/g, '');
  const open = !cancelled && !a.paid && a.status !== 'NO_SHOW';
  // перенести самому можно не позже чем за 2 часа до начала
  const canMove = open && a.startsAt.getTime() - Date.now() >= CLIENT_MOVE_HOURS * 3600e3;
  const today = utcToZoned(new Date(), a.salon.timezone).date;
  return (
    <main className="app home">
      <div className="page" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <header className="row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {a.salon.logoUrl && <img src={a.salon.logoUrl} alt="" width={44} height={44} style={{ borderRadius: 12 }} />}
          <div><h1 style={{ fontSize: 22 }}>{tr('Ваша запись')}</h1><span className="small muted">{tr('Салон')} «{a.salon.name}»</span></div>
        </header>
        {cancelled && <div className="error">{tr('Эта запись отменена.')}</div>}
        {a.status === 'NO_SHOW' && <div className="error">{tr('Эта запись закрыта: вас не дождались. Запишитесь на другое время — будем рады вас видеть.')}</div>}
        <section className="card stack" style={{ gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>{hhmm(minute)}–{hhmm(end)}</div>
            <div className="muted">{weekdayFull(date, lang)}, {dayMonth(date, lang)}</div>
          </div>
          <div className="row">
            <span className="avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {a.staff.photoUrl ? <img src={a.staff.photoUrl} alt="" /> : a.staff.name[0]}
            </span>
            <div>
              <strong>{a.staff.name}</strong>
              <div className="small muted">{a.service.category.name}: {a.service.name}{a.addons.length ? ` + ${a.addons.map((x) => x.addon.name.toLowerCase()).join(', ')}` : ''}</div>
              {a.client.guardianId && <div className="small muted">{tr('Для')}: {a.client.name}</div>}
            </div>
          </div>
          <div className="row"><span className="grow muted">{a.paid ? tr('Оплачено') : tr('К оплате в салоне')}</span><strong>{a.paid ? formatSom(a.finalPrice ?? a.price) : formatPrice(a.price, a.priceMax)}</strong></div>
          <div className="row"><span className="grow muted">{tr('Адрес')}</span><strong>{[a.salon.city, a.salon.address].filter(Boolean).join(', ')}</strong></div>
          <a className="btn" href={mapLink(a.salon)} target="_blank" rel="noreferrer" style={{ minHeight: 42 }}>📍 {tr('Как добраться (2ГИС)')}</a>
        </section>
        {!cancelled && !a.paid && a.status !== 'NO_SHOW' && <ConfirmButton slug={slug} id={a.id} token={t} confirmed={!!a.confirmedAt} />}
        {canMove && (
          <RescheduleButton slug={slug} id={a.id} title={`${a.service.name} · ${a.staff.name}`} date={date} today={today}
            client={{ token: t, days: a.salon.bookingHorizonDays }} label={'↔ ' + tr('Перенести на другое время')} style={{ minHeight: 46, fontSize: 15 }} />
        )}
        {open && !canMove && a.startsAt.getTime() > Date.now() && (
          <span className="small muted">{tr('Перенести запись за {n} часа до начала можно только через салон — напишите или позвоните.', { n: CLIENT_MOVE_HOURS })}</span>
        )}
        {!cancelled && !a.paid && a.status !== 'NO_SHOW' && <LateButtons slug={slug} id={a.id} token={t} lateMinutes={a.lateMinutes} />}
        {a.paid && <RateVisit slug={slug} id={a.id} token={t} master={a.staff.name} done={review?.stars ?? null} mapUrl={a.salon.mapUrl} bonus={a.salon.reviewBonus} />}
        <InstallCard bonus={a.client.welcomeBonusAt ? 0 : a.salon.welcomeBonus} />
        {!cancelled && !a.paid && <PushOptIn slug={slug} appointmentId={a.id} token={t} compact />}
        {wa && <a className="btn block" href={`https://wa.me/${wa}`}>{tr('Написать в салон в WhatsApp')}</a>}
      </div>
      <ClaimMe slug={slug} id={a.id} token={t} />
      <ClientNav slug={slug} inline />
    </main>
  );
}
