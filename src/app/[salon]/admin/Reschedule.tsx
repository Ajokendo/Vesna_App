'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { addDays, dayMonth, dayMonthShort, hhmm, weekdayShort } from '@/lib/time';
import { useLang } from '@/app/Lang';
import { makeT } from '@/lib/i18n';

type Options = {
  date: string; durationMin?: number;
  current: { date: string; minute: number; staffId: string };
  masters: { id: string; name: string; photoUrl: string | null; same: boolean; hours: { start: number; end: number } | null; starts: number[] }[];
};

/** Кнопка «Перенести» + окно выбора нового дня и времени */
export function RescheduleButton({ slug, id, title, date, today, style, onMoved, client, label = '↔ Перенести' }: {
  slug: string; id: string; title: string; date: string; today: string; style?: React.CSSProperties; onMoved?: () => void;
  /** Перенос самим клиентом: ключ из ссылки на запись и сколько дней вперёд открыта запись */
  client?: { token: string; days: number }; label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn" style={{ minHeight: 40, fontSize: 14, ...style }} onClick={() => setOpen(true)}>{label}</button>
      {open && <RescheduleDialog slug={slug} id={id} title={title} startDate={date < today ? today : date} today={today} client={client}
        onClose={() => setOpen(false)} onMoved={() => { setOpen(false); onMoved?.(); }} />}
    </>
  );
}

function RescheduleDialog({ slug, id, title, startDate, today, onClose, onMoved, client }: {
  slug: string; id: string; title: string; startDate: string; today: string; onClose: () => void; onMoved: () => void; client?: { token: string; days: number };
}) {
  const userLang = useLang();
  const lang = client ? userLang : 'ru'; // переводим только экран клиента
  const t = makeT(lang);
  // администратор — свой адрес; клиент — адрес записи с ключом из ссылки
  const api = client ? `/api/${slug}/visits/${id}/reschedule` : `/api/${slug}/admin/appointments/${id}/reschedule`;
  const q = client ? `t=${encodeURIComponent(client.token)}&` : '';
  const router = useRouter();
  const [date, setDate] = useState(startDate);
  const [opts, setOpts] = useState<Options | null>(null);
  const [loading, setLoading] = useState(true);
  const [pick, setPick] = useState<{ staffId: string; name: string; minute: number } | null>(null);
  const [others, setOthers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const days = Array.from({ length: client ? Math.min(client.days, 30) : 21 }, (_, i) => addDays(today, i));

  useEffect(() => {
    let alive = true;
    setLoading(true); setPick(null); setError(null);
    fetch(`${api}?${q}date=${date}`).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!alive) return;
      if (!r.ok) setError(d.error ?? t('Не получилось загрузить время')); else setOpts(d);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [api, q, date]);

  async function save() {
    if (!pick) return;
    setBusy(true); setError(null);
    const r = await fetch(`${api}${client ? `?${q.slice(0, -1)}` : ''}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staffId: pick.staffId, date, minute: pick.minute }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error ?? t('Не получилось')); return; }
    router.refresh();
    onMoved();
  }

  const same = opts?.masters.find((m) => m.same);
  const rest = opts?.masters.filter((m) => !m.same) ?? [];
  const chip = (on: boolean) => ({
    minWidth: 52, padding: '6px 0', borderRadius: 12, border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
    background: on ? 'var(--accent)' : '#fff', color: on ? '#fff' : 'var(--ink)', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    flex: '0 0 auto', font: 'inherit',
  });

  const Times = ({ m }: { m: Options['masters'][number] }) => (
    !m.hours ? <span className="small muted">{t('Не работает в этот день')}</span>
      : !m.starts.length ? <span className="small muted">{t('Свободного времени нет')}</span>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 6 }}>
            {m.starts.map((t) => {
              const on = pick?.staffId === m.id && pick.minute === t;
              return (
                <button key={t} type="button" onClick={() => setPick({ staffId: m.id, name: m.name, minute: t })} aria-pressed={on}
                  style={{ minHeight: 40, borderRadius: 10, border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'var(--accent)' : '#fff', color: on ? '#fff' : 'var(--ink)', fontWeight: 800, cursor: 'pointer' }}>
                  {hhmm(t)}
                </button>
              );
            })}
          </div>
        )
  );

  return (
    <div role="dialog" aria-modal="true" aria-label={t('Перенос записи')} onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(23,35,28,.35)', zIndex: 70, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div className="card stack" onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 520, gap: 14, maxHeight: '92dvh', overflowY: 'auto', borderRadius: '20px 20px 0 0',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
      }}>
        <div>
          <strong style={{ fontSize: 18 }}>{client ? t('Перенести на другое время') : 'Перенести запись'}</strong>
          <div className="small muted">{title}</div>
          {opts && <div className="small muted">{t('Сейчас')}: {weekdayShort(opts.current.date, lang)}, {dayMonth(opts.current.date, lang)}, {hhmm(opts.current.minute)}{opts.durationMin ? ` · ${opts.durationMin} ${t('мин')}` : ''}</div>}
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }} aria-label={t('День')}>
          {days.map((d) => (
            <button key={d} type="button" style={chip(d === date)} onClick={() => setDate(d)} aria-pressed={d === date}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{d === today ? t('сег.') : weekdayShort(d, lang)}</span>
              <strong>{Number(d.slice(8))}</strong>
              <span style={{ fontSize: 10 }}>{dayMonthShort(d, lang).split(' ')[1]}</span>
            </button>
          ))}
        </div>

        {loading ? <p className="muted" style={{ margin: 0 }}>{t('Смотрим свободное время…')}</p> : opts && (
          <>
            {same && (
              <section className="stack" style={{ gap: 8 }}>
                <strong className="small">{t('К тому же мастеру')} — {same.name}{same.hours ? ` (${hhmm(same.hours.start)}–${hhmm(same.hours.end)})` : ''}</strong>
                <Times m={same} />
              </section>
            )}
            {rest.length > 0 && (others ? (
              rest.map((m) => (
                <section key={m.id} className="stack" style={{ gap: 8 }}>
                  <strong className="small">{m.name}{m.hours ? ` (${hhmm(m.hours.start)}–${hhmm(m.hours.end)})` : ''}</strong>
                  <Times m={m} />
                </section>
              ))
            ) : (
              <button type="button" className="small" onClick={() => setOthers(true)} style={{ alignSelf: 'flex-start', border: 0, background: 'none', padding: 0, color: 'var(--accent-dark)', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer' }}>
                {t('Показать время у других мастеров ({n} свободны)', { n: rest.filter((m) => m.starts.length).length })}
              </button>
            ))}
          </>
        )}

        {error && <div className="error" role="alert">{error}</div>}
        <div className="row" style={{ position: 'sticky', bottom: 0, background: 'var(--card)', paddingTop: 8 }}>
          <button type="button" className="btn" onClick={onClose}>{t('Закрыть')}</button>
          <button type="button" className="btn primary grow" disabled={!pick || busy} onClick={save}>
            {busy ? t('Переносим…') : pick ? `${t('Перенести на')} ${weekdayShort(date, lang)} ${Number(date.slice(8))}, ${hhmm(pick.minute)}${same && pick.staffId !== same.id ? ` · ${pick.name}` : ''}` : t('Выберите время')}
          </button>
        </div>
        <span className="small muted">{client ? t('Салон сразу увидит новое время в журнале. Напоминание о визите придёт к новому времени.') : 'Клиенту с включёнными уведомлениями сразу придёт сообщение о новом времени, напоминания придут заново.'}</span>
      </div>
    </div>
  );
}
