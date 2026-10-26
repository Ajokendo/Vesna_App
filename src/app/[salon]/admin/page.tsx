import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCatalog, getJournal, getSalon } from '@/server/salon';
import { dayMonth, hhmm, utcToZoned, weekdayFull } from '@/lib/time';
import NewAppointment from './NewAppointment';
import ApptCard from './ApptCard';
import ReminderTicker from './ReminderTicker';
import { AbsenceControl, ConflictList, type Conflict } from './Absence';
import DroppedList from './DroppedList';
import DayStrip from './DayStrip';
import { GROUPS } from '@/lib/groups';

export const dynamic = 'force-dynamic';



const PX = 1.2; // пикселей на минуту

type ColState = 'work' | 'changed' | 'extra' | 'off' | 'absent';
/** Цвета состояния мастера на день: полоска над колонкой, плашка в шапке и фон колонки */
const STATE: Record<ColState, { label: string; bar: string; bg: string; fg: string; body: string }> = {
  work: { label: 'Работает', bar: '#6f8f63', bg: '#e6efe0', fg: '#3d5a34', body: '' },
  changed: { label: 'Сегодня', bar: '#d9822b', bg: '#fbead8', fg: '#9a5410', body: '' },
  extra: { label: 'Выход в выходной', bar: '#c9a24a', bg: '#f6ecd2', fg: '#7d6220', body: '' },
  off: { label: 'Выходной', bar: '#c4c9c0', bg: '#eceee8', fg: '#6f786c', body: 'repeating-linear-gradient(135deg,#eceee8 0 10px,#f6f8f5 10px 20px)' },
  absent: { label: 'Не выйдет', bar: '#b23a5a', bg: '#f8e3e8', fg: '#9b2747', body: 'repeating-linear-gradient(135deg,#f6e1e6 0 10px,#fcf4f6 10px 20px)' },
};
function stateOf(c: { day: unknown; normal: unknown; absence: { dayOff: boolean } | null }): ColState {
  if (c.absence?.dayOff) return 'absent';
  if (!c.day) return 'off';
  if (c.absence) return c.normal ? 'changed' : 'extra';
  return 'work';
}

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
  const [{ columns, dropped }, catalog] = await Promise.all([getJournal(slug, date), getCatalog(salon.id)]);
  const cols = columns.filter((c) => c.group === group);

  const START = Math.min(9 * 60, ...cols.filter((c) => c.day).map((c) => c.day!.start));
  const END = Math.max(20 * 60, ...cols.filter((c) => c.day).map((c) => c.day!.end));
  const hours = Array.from({ length: Math.floor((END - START) / 60) + 1 }, (_, i) => START + i * 60).filter((m) => m % 60 === 0 || m === START);
  const total = columns.reduce((n, c) => n + c.items.length, 0);
  const link = (d: string, g: string = group) => `/${slug}/admin?date=${d}&group=${g}`;

  return (
    <main className="safe" style={{ padding: '24px 28px 40px', display: 'flex', flexDirection: 'column', gap: 18, minHeight: '100dvh', overflowX: 'clip', maxWidth: '100vw' }}>
      <h1 style={{ fontSize: 26 }}>Журнал записей</h1>

      <DayStrip salon={salon} date={date} today={now.date} href={(d) => link(d)} note={`записей: ${total} · под датой — число записей в этот день`} />

      <div className="tabs" style={{ width: '100%', maxWidth: 640 }}>
        {GROUPS.map((g) => (
          <Link key={g.id} href={link(date, g.id)} aria-current={g.id === group ? 'page' : undefined}
            style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px 6px', fontSize: 14, lineHeight: 1.2, borderRadius: 12, fontWeight: 800, textDecoration: 'none', color: g.id === group ? 'var(--ink)' : 'var(--muted)', background: g.id === group ? '#fff' : 'transparent' }}>
            {g.name}
          </Link>
        ))}
      </div>

      <ReminderTicker />
      <NewAppointment key={group} slug={slug} date={date} catalog={catalog} group={group} />

      <DroppedList slug={slug} items={dropped} />
      <ConflictList slug={slug} salonName={salon.name} dateLabel={`${weekdayFull(date)}, ${dayMonth(date)},`} items={columns.flatMap((c) => c.items.filter((i) => i.conflict).map((i): Conflict => ({
        id: i.id, start: i.start, end: i.end, client: i.client, phone: i.phone, service: i.service, master: c.name, alternatives: i.alternatives,
      })))} />

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <div style={{ minWidth: 220 * cols.length + 64, display: 'grid', gridTemplateColumns: `64px repeat(${cols.length}, minmax(220px, 1fr))` }}>
          {/* колонка времени «заморожена» слева: при прокрутке вбок остаётся на месте */}
          <div style={{ borderBottom: '1px solid var(--line)', position: 'sticky', left: 0, zIndex: 3, background: 'var(--card)', borderRight: '1px solid var(--line)' }} />
          {cols.map((c) => {
            const st = STATE[stateOf(c)];
            const hours = c.day ? `${hhmm(c.day.start)}–${hhmm(c.day.end)}` : '';
            return (
              <div key={c.id} style={{ padding: '10px 12px 12px', borderBottom: '1px solid var(--line)', borderLeft: '1px solid var(--line)', borderTop: `4px solid ${st.bar}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="row" style={{ gap: 10 }}>
                  <span className="avatar" style={{ width: 40, height: 40, fontSize: 16 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.photoUrl ? <img src={c.photoUrl} alt="" /> : c.name[0]}
                  </span>
                  <strong style={{ fontSize: 16, lineHeight: 1.2 }}>{c.name}</strong>
                </div>
                <span style={{ alignSelf: 'flex-start', background: st.bg, color: st.fg, borderRadius: 999, padding: '3px 10px', fontSize: 13, fontWeight: 800 }}>
                  {st.label}{hours ? ` ${hours}` : ''}
                </span>
                {c.absence?.note && <span className="small" style={{ color: st.fg }}>{c.absence.note}</span>}
                <span className="small muted" style={{ lineHeight: 1.3 }}>{c.scheduleLabel}</span>
                <AbsenceControl slug={slug} staffId={c.id} name={c.name} date={date} absence={c.absence} normal={c.normal} usual={c.usual} />
              </div>
            );
          })}

          <div style={{ position: 'sticky', left: 0, zIndex: 3, height: (END - START) * PX, background: 'var(--card)', borderRight: '1px solid var(--line)', boxShadow: '4px 0 8px -6px rgba(30,40,30,.25)' }}>
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
                <div style={{ position: 'absolute', inset: 8, borderRadius: 14, background: STATE[stateOf(c)].body, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 24, fontWeight: 800, fontSize: 15, color: STATE[stateOf(c)].fg }}>
                  {STATE[stateOf(c)].label}
                </div>
              )}
              {stateOf(c) === 'extra' && c.day && <div style={{ position: 'absolute', left: 0, right: 0, top: (c.day.start - START) * PX, height: (c.day.end - c.day.start) * PX, background: 'rgba(201,162,74,.10)' }} />}
              {c.day && c.day.start > START && <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: (c.day.start - START) * PX, background: '#f3f4f0' }} />}
              {c.day && c.day.end < END && <div style={{ position: 'absolute', left: 0, right: 0, top: (c.day.end - START) * PX, bottom: 0, background: '#f3f4f0' }} />}
              {c.items.map((a) => (
                <ApptCard key={a.id} a={a} top={(a.start - START) * PX} px={PX} slug={slug} earnPercent={salon.pointsPercent} masterPercent={c.masterPercent}
                  rules={{ today: now.date, nowMinute: date === now.date ? now.minute : date < now.date ? 24 * 60 : null, callAfter: salon.lateCallMinutes, noShowAfter: salon.noShowMinutes, salonName: salon.name }} />
              ))}
              {date === now.date && now.minute >= START && now.minute <= END && (
                <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: (now.minute - START) * PX, borderTop: '2px dashed #b23a5a' }} />
              )}
            </div>
          ))}
        </div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Цвет полоски над мастером: зелёный — работает, оранжевый — сегодня другие часы, золотой — вышел в свой выходной, серый — выходной, красный — не выйдет. Нажмите на запись, чтобы принять оплату. 🔔 — у клиента включены напоминания, «подтвердил» — подтвердил визит из уведомления, ⏱ — время окончания изменено (золотая рамка — отметил сам мастер). Журнал обновляется сам каждую минуту. Белые — ожидаются, зелёные — оплачены, кремовые — без записи.
        Пунктир — выдержка краски: в это время мастер свободен и к нему можно записать другого клиента. Красная линия — текущее время.
      </p>

    </main>
  );
}
