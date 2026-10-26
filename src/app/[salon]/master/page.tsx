import Link from 'next/link';
import BottomBar from '@/app/BottomBar';
import Feedback from '@/app/Feedback';
import { notFound, redirect } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { currentMaster, signInMaster, signOutMaster } from '@/server/master-auth';
import { getMasterDay, getMasterMonth, getMasterWeek, getMastersForLogin } from '@/server/master';
import { addDays, dayMonth, dayMonthShort, hhmm, utcToZoned, weekdayFull, weekdayShort } from '@/lib/time';
import { formatPrice, formatSom } from '@/lib/pricing';
import EndToggle from './EndToggle';
import VisitButtons from './VisitButtons';
import { lateState } from '@/lib/late';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Кабинет мастера' };

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

export default async function MasterPage({ params, searchParams }: {
  params: Promise<{ salon: string }>;
  searchParams: Promise<{ date?: string; who?: string; e?: string }>;
}) {
  const { salon: slug } = await params;
  const sp = await searchParams;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const me = await currentMaster(salon.id);

  if (!me) {
    const masters = await getMastersForLogin(salon.id);
    const chosen = masters.find((m) => m.id === sp.who);
    async function login(formData: FormData) {
      'use server';
      const who = String(formData.get('who') ?? '');
      const res = await signInMaster(salon!.id, who, String(formData.get('pin') ?? ''));
      redirect(res.ok ? `/${slug}/master` : `/${slug}/master?who=${encodeURIComponent(who)}&e=${encodeURIComponent(res.error)}`);
    }
    return (
      <main className="app">
        <div className="page">
          <header className="row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {salon.logoUrl && <img src={salon.logoUrl} alt="" width={44} height={44} style={{ borderRadius: 12 }} />}
            <div>
              <h1 style={{ fontSize: 24 }}>Кабинет мастера</h1>
              <span className="small muted">Салон «{salon.name}»</span>
            </div>
          </header>
          {!chosen ? (
            <section className="stack">
              <strong>Кто вы?</strong>
              <div className="grid2">
                {masters.map((m) => (
                  <Link key={m.id} href={`/${slug}/master?who=${m.id}`} className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'var(--ink)' }}>
                    <span className="avatar" style={{ width: 64, height: 64 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {m.photoUrl ? <img src={m.photoUrl} alt="" /> : m.name[0]}
                    </span>
                    <strong>{m.name}</strong>
                  </Link>
                ))}
              </div>
            </section>
          ) : (
            <form action={login} className="card stack" style={{ gap: 14 }}>
              <input type="hidden" name="who" value={chosen.id} />
              <div className="row">
                <span className="avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {chosen.photoUrl ? <img src={chosen.photoUrl} alt="" /> : chosen.name[0]}
                </span>
                <div className="grow"><strong style={{ fontSize: 18 }}>{chosen.name}</strong><div className="small muted">{chosen.title}</div></div>
              </div>
              {chosen.hasPin ? (
                <>
                  <label className="field">Ваш PIN-код
                    <input name="pin" type="password" inputMode="numeric" autoComplete="current-password" pattern="\d{4,6}" required autoFocus />
                  </label>
                  {sp.e && <div className="error" role="alert">{sp.e}</div>}
                  <button type="submit" className="btn primary block">Войти</button>
                </>
              ) : <div className="note">PIN-код ещё не выдан. Попросите администратора задать его в журнале → «Мастера и PIN».</div>}
              <Link href={`/${slug}/master`} className="small muted" style={{ textAlign: 'center' }}>Это не я</Link>
            </form>
          )}
        </div>
      <BottomBar items={[{ label: 'Главная', icon: 'home', href: `/${slug}` }]} />
      </main>
    );
  }

  const now = utcToZoned(new Date(), salon.timezone);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : now.date;
  const [day, week, month] = await Promise.all([getMasterDay(salon, me, date), getMasterWeek(salon, me, now.date), getMasterMonth(salon, me, date)]);
  const link = (d: string) => `/${slug}/master?date=${d}`;
  const isOwner = me.roles.includes('OWNER');

  async function logout() {
    'use server';
    await signOutMaster();
    redirect(`/${slug}/master`);
  }

  return (
    <main className="app">
      <div className="page" style={{ gap: 18 }}>
        <header className="row">
          <span className="avatar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {me.photoUrl ? <img src={me.photoUrl} alt="" /> : me.name[0]}
          </span>
          <div className="grow">
            <h1 style={{ fontSize: 22 }}>{me.name}</h1>
            <span className="small muted">{day.scheduleLabel}{isOwner ? '' : ` · ваша доля ${day.percent}%`}</span>
          </div>
        </header>

        {/* ближайшая неделя */}
        <nav className="grid7" aria-label="Ближайшие дни">
          {week.map((d) => {
            const on = d.date === date;
            return (
              <Link key={d.date} href={link(d.date)} aria-current={on ? 'date' : undefined} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 0', borderRadius: 12, textDecoration: 'none',
                background: on ? 'var(--accent)' : d.hours ? '#fff' : '#eceee8', color: on ? '#fff' : d.hours ? 'var(--ink)' : '#8a9488',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
              }}>
                <span className="small" style={{ fontWeight: 700, color: 'inherit' }}>{weekdayShort(d.date)}</span>
                <strong style={{ fontSize: 16 }}>{Number(d.date.slice(8))}</strong>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{d.hours ? (d.count ? `${d.count} зап.` : '—') : 'вых.'}</span>
              </Link>
            );
          })}
        </nav>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 20 }}>{date === now.date ? 'Сегодня' : weekdayFull(date)}, {dayMonth(date)}</h2>
            <span className="small muted">{day.hours ? `Работаю ${hhmm(day.hours.start)}–${hhmm(day.hours.end)}` : 'Выходной'} · записей: {day.items.length}</span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <Link className="btn" style={{ minHeight: 40, padding: '0 12px' }} href={link(addDays(date, -1))} aria-label="Предыдущий день">‹</Link>
            <Link className="btn" style={{ minHeight: 40, padding: '0 12px' }} href={link(addDays(date, 1))} aria-label="Следующий день">›</Link>
          </div>
        </div>

        {/* записи */}
        <section className="stack" aria-label="Мои записи">
          {day.items.length === 0 && <p className="muted" style={{ margin: 0 }}>{day.hours ? 'Записей пока нет.' : 'В этот день у вас выходной.'}</p>}
          {day.items.map((i) => (
            <article key={i.id} className="card" style={{ display: 'grid', gridTemplateColumns: '58px 1fr', gap: 12, padding: 14, borderColor: i.paid ? '#a9bc9c' : 'var(--line)', background: i.paid ? 'var(--accent-soft)' : '#fff' }}>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ fontSize: 17 }}>{hhmm(i.start)}</strong>
                <div className="small muted">{hhmm(i.end)}</div>
              </div>
              <div className="stack" style={{ gap: 4 }}>
                <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <strong>{i.client}</strong>
                  <span className="small" style={{ fontWeight: 800, color: i.paid ? 'var(--accent-dark)' : 'var(--muted)' }}>{i.paid ? '✓ оплачено' : 'ожидается'}</span>
                </div>
                <span className="small"><span className="muted">{i.category}:</span> {i.service}</span>
                {i.addons.map((a) => <span key={a.name} className="small">+ {a.name}{a.price ? ` · ${formatSom(a.price)}` : ' · бесплатно'}</span>)}
                {i.pause && <span className="note" style={{ padding: '4px 8px', fontSize: 12 }}>Выдержка краски {hhmm(i.pause.from)}–{hhmm(i.pause.to)}: в это время вы свободны</span>}
                <span className="small muted">Стоимость: {i.paid ? formatSom(i.finalPrice) : formatPrice(i.price, i.priceMax)}</span>
                {i.plannedEnd != null && i.plannedEnd !== i.end && (
                  <span className="small" style={{ color: '#7a5a1c', fontWeight: 700 }}>⏱ Окончание изменено: было {hhmm(i.plannedEnd)}{i.endChangedByMaster ? ' (вы)' : ' (администратор)'}</span>
                )}
                {(() => {
                  if (i.status === 'NO_SHOW') return <span className="small" style={{ color: 'var(--danger)', fontWeight: 700 }}>Клиент не пришёл — время свободно</span>;
                  if (i.status === 'CANCELLED') return <span className="small muted" style={{ fontWeight: 700 }}>Запись отменена</span>;
                  const late = lateState({ start: i.start, nowMinute: date === now.date ? now.minute : null, paid: i.paid, arrived: i.arrived, lateMinutes: i.lateMinutes, callAfter: salon.lateCallMinutes, noShowAfter: salon.noShowMinutes });
                  return (
                    <>
                      {i.lateMinutes ? <span className="small" style={{ color: '#7a5a1c', fontWeight: 700 }}>Клиент предупредил: опоздает на {i.lateMinutes} мин</span> : null}
                      {late === 'call' && <span className="small" style={{ color: '#b0620c', fontWeight: 700 }}>Клиент опаздывает — администратор звонит ему</span>}
                      {late === 'noshow' && <span className="small" style={{ color: 'var(--danger)', fontWeight: 700 }}>Клиент так и не пришёл?</span>}
                      {i.arrived && !i.paid && <span className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>✓ Клиент в салоне</span>}
                      {!i.paid && !i.arrived && date === now.date && now.minute >= i.start - 15 && <VisitButtons slug={slug} id={i.id} canNoShow={now.minute >= i.start} />}
                      {!i.paid && date >= now.date && <EndToggle slug={slug} id={i.id} start={i.start} end={i.end} />}
                    </>
                  );
                })()}
              </div>
            </article>
          ))}
        </section>

        {/* заработок за день */}
        <section className="card stack" style={{ gap: 10 }} aria-labelledby="earn">
          <h2 id="earn" style={{ fontSize: 18 }}>Мой заработок за {date === now.date ? 'сегодня' : dayMonthShort(date)}</h2>
          {isOwner ? <p className="small muted" style={{ margin: 0 }}>Вы хозяйка салона — комиссия не начисляется, вся выручка идёт салону.</p> : null}
          {day.totals.visits === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Оплаченных визитов пока нет{day.totals.waiting ? ` (ожидается: ${day.totals.waiting})` : ''}.</p>
          ) : (
            <>
              <div className="stack" style={{ gap: 0 }}>
                {day.items.filter((i) => i.paid).map((i) => (
                  <div key={i.id} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span><strong>{hhmm(i.start)} {i.client}</strong><span className="small muted"> · {i.service}</span></span>
                      <strong style={{ whiteSpace: 'nowrap' }}>{formatSom(i.share)}</strong>
                    </div>
                    {i.pointsUsed > 0 ? (
                      <div className="small muted" style={{ marginTop: 2, lineHeight: 1.45 }}>
                        Услуга {formatSom(i.finalPrice)}, клиент оплатил <strong style={{ color: 'var(--ink)' }}>{i.pointsUsed} баллами</strong> и {formatSom(i.cash)} деньгами.
                        Доля {i.percent}% считается с {formatSom(i.cash)}{i.percent ? ` (без баллов было бы ${formatSom(i.shareWithoutPoints)})` : ''}.
                      </div>
                    ) : (
                      <div className="small muted" style={{ marginTop: 2 }}>{formatSom(i.cash)} · {i.percent}%</div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--ground)', borderRadius: 14, padding: 12 }} className="stack">
                <Row label={`Визитов оплачено${day.totals.waiting ? ` (ещё ожидается: ${day.totals.waiting})` : ''}`} value={String(day.totals.visits)} />
                <Row label="Стоимость услуг" value={formatSom(day.totals.price)} />
                {day.totals.points > 0 && <Row label="Из них оплачено баллами" value={`−${day.totals.points}`} />}
                <Row label="Получено деньгами" value={formatSom(day.totals.cash)} />
                <Row label="Моя доля" value={formatSom(day.totals.share)} strong />
              </div>
            </>
          )}
        </section>

        <section className="card stack" style={{ gap: 8, borderColor: 'var(--gold)' }} aria-labelledby="month">
          <h2 id="month" style={{ fontSize: 18 }}>За {MONTHS[Number(month.month.slice(5, 7)) - 1]}</h2>
          <Row label="Визитов" value={String(month.visits)} />
          <Row label="Получено деньгами" value={formatSom(month.cash)} />
          {month.points > 0 && <Row label="Оплачено баллами" value={String(month.points)} />}
          <Row label="Моя доля" value={formatSom(month.share)} strong />
        </section>

        <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Баллы — это скидка постоянным клиентам. Если клиент часть суммы оплатил баллами, доля мастера и салона считается с суммы, оплаченной деньгами:
          скидку салон и мастер делят поровну.
        </p>
        <Feedback salon={slug} role="MASTER"><button type="button" className="small" style={{ border: 0, background: 'none', padding: 0, color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer' }}>✉ Написать разработчикам приложения</button></Feedback>
      </div>
      <BottomBar items={[
        { label: 'Главная', icon: 'home', href: `/${slug}` },
        { label: 'Записи', icon: 'list', href: link(now.date), current: true },
        { label: 'Заработок', icon: 'money', href: `${link(date)}#earn` },
        { label: 'Выйти', icon: 'exit', action: logout },
      ]} />
    </main>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', fontSize: strong ? 17 : 14, fontWeight: strong ? 800 : 500 }}>
      <span className={strong ? undefined : 'muted'}>{label}</span><span>{value}</span>
    </div>
  );
}
