import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { getClientCard } from '@/server/clients';
import { dayMonth, dayMonthShort, hhmm, utcToZoned, weekdayShort } from '@/lib/time';
import { formatPrice, formatSom } from '@/lib/pricing';
import { RescheduleButton } from '../../Reschedule';
import ClientEditor from './ClientEditor';
import Referral from './Referral';
import { referralInfo } from '@/server/referral';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { text: string; color: string }> = {
  CANCELLED: { text: 'отменена', color: 'var(--muted)' },
  NO_SHOW: { text: 'не пришёл', color: 'var(--danger)' },
};

/** Карточка клиента: связь, заметка, баллы, предстоящие визиты (перенос) и история */
export default async function ClientCard({ params }: { params: Promise<{ salon: string; id: string }> }) {
  const { salon: slug, id } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const card = await getClientCard(slug, id);
  if (!card) notFound();
  const ref = await referralInfo(card.guardian?.id ?? id);
  const today = utcToZoned(new Date(), salon.timezone).date;
  const { client: c } = card;
  const phone = (c.phone ?? card.guardian?.phone ?? '').replace(/\D/g, '');
  const age = c.birthDate ? Math.floor((Date.parse(today) - Date.parse(c.birthDate)) / (365.25 * 86400000)) : null;

  return (
    <main className="safe" style={{ padding: '24px 28px 40px', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Link href={`/${slug}/admin/clients`} className="small muted">‹ Все клиенты</Link>
      <header className="row" style={{ gap: 14, alignItems: 'center' }}>
        <span className="avatar" style={{ width: 56, height: 56 }}>{c.name[0]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 24 }}>{c.name}</h1>
          <span className="small muted">
            {c.phone ?? (card.guardian ? `ребёнок · ${card.guardian.name}, ${card.guardian.phone ?? ''}` : 'без телефона')}
            {age != null ? ` · ${age} лет` : ''} · клиент с {dayMonthShort(c.createdAt)}
          </span>
        </div>
      </header>

      {phone && (
        <div className="row" style={{ gap: 8 }}>
          <a className="btn" style={{ flex: 1, minHeight: 44 }} href={`tel:+${phone}`}>Позвонить</a>
          <a className="btn" style={{ flex: 1, minHeight: 44 }} target="_blank" rel="noreferrer" href={`https://wa.me/${phone}?text=${encodeURIComponent(`Здравствуйте, ${card.guardian?.name ?? c.name}! Это салон «${card.salonName}».`)}`}>WhatsApp</a>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <Stat label="Визитов" value={String(card.stats.visits)} />
        <Stat label={card.points.own ? 'Баллов' : `Баллов (у ${card.points.owner})`} value={String(card.points.balance)} accent />
        <Stat label="Оплачено деньгами" value={formatSom(card.stats.spent)} />
        <Stat label="Не пришёл" value={String(card.stats.noShows)} danger={card.stats.noShows > 0} />
      </div>
      {card.stats.favorite && <span className="small muted">Чаще всего ходит к: <strong style={{ color: 'var(--ink)' }}>{card.stats.favorite}</strong></span>}

      {card.guardian && <Link href={`/${slug}/admin/clients/${card.guardian.id}`} className="small">Родитель: {card.guardian.name} ›</Link>}
      {card.children.length > 0 && (
        <div className="row small" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span className="muted">Дети:</span>
          {card.children.map((k) => <Link key={k.id} href={`/${slug}/admin/clients/${k.id}`}>{k.name} ›</Link>)}
        </div>
      )}

      <ClientEditor slug={slug} c={c} child={!!card.guardian} />
      <Referral slug={slug} clientId={card.guardian?.id ?? c.id} info={ref} canSet={card.stats.visits === 0 && !ref.rewarded} bonus={salon.referralBonus} />

      <section className="stack" style={{ gap: 8 }}>
        <h2 style={{ fontSize: 18 }}>Предстоящие записи</h2>
        {!card.upcoming.length && <p className="muted small" style={{ margin: 0 }}>Нет. Новую запись можно сделать в журнале кнопкой «+ Запись».</p>}
        {card.upcoming.map((v) => (
          <div key={v.id} className="card stack" style={{ gap: 8, padding: '12px 14px' }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <Link href={`/${slug}/admin?date=${v.date}`} style={{ fontWeight: 800, color: 'var(--ink)' }}>
                {v.date === today ? 'Сегодня' : `${weekdayShort(v.date)}, ${dayMonth(v.date)}`}, {hhmm(v.start)}–{hhmm(v.end)}
              </Link>
              <span className="small muted">{formatPrice(v.price, v.priceMax)}</span>
            </div>
            <span className="small">{v.service}{v.addons.length ? ` + ${v.addons.join(', ').toLowerCase()}` : ''} · {v.staff}</span>
            <RescheduleButton slug={slug} id={v.id} title={`${c.name} · ${v.service}`} date={v.date} today={today} style={{ alignSelf: 'flex-start' }} />
          </div>
        ))}
      </section>

      <section className="stack" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 18 }}>История визитов</h2>
        {!card.history.length && <p className="muted small" style={{ margin: 0 }}>Пока пусто.</p>}
        {card.history.map((v) => (
          <div key={v.id} className="row" style={{ justifyContent: 'space-between', gap: 10, borderBottom: '1px solid var(--line)', padding: '8px 0', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{dayMonthShort(v.date)} {v.date.slice(0, 4) !== today.slice(0, 4) ? v.date.slice(0, 4) : ''} · {v.service}</div>
              <div className="small muted">{v.staff}{v.addons.length ? ` · + ${v.addons.join(', ').toLowerCase()}` : ''}</div>
            </div>
            <div className="small" style={{ textAlign: 'right', flex: '0 0 auto' }}>
              {v.paid ? (
                <>
                  <div style={{ fontWeight: 800 }}>{formatSom(v.price)}</div>
                  {v.pointsUsed > 0 && <div className="muted">баллами −{v.pointsUsed}</div>}
                </>
              ) : (
                <span style={{ color: STATUS[v.status]?.color ?? 'var(--muted)', fontWeight: 700 }}>
                  {STATUS[v.status]?.text ?? 'не оплачена'}{v.status === 'CANCELLED' && v.cancelledBy === 'CLIENT' ? ' клиентом' : ''}
                </span>
              )}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

function Stat({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <div className="small muted" style={{ lineHeight: 1.2 }}>{label}</div>
      <strong style={{ fontSize: 20, color: danger ? 'var(--danger)' : accent ? 'var(--accent-dark)' : 'var(--ink)' }}>{value}</strong>
    </div>
  );
}
