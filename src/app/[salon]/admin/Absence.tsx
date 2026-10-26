'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { hhmm } from '@/lib/time';

const toMin = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };
const toTime = (m: number) => hhmm(m);
const input = { minHeight: 44, borderRadius: 12, border: '1px solid #dde5de', padding: '0 12px', fontSize: 15, background: '#fff' } as const;

/** Отметка «мастер не выйдет» в шапке колонки журнала */
export function AbsenceControl({ slug, staffId, name, date, absence, normal, usual }: {
  slug: string; staffId: string; name: string; date: string;
  absence: { dayOff: boolean; start: number | null; end: number | null; note: string | null } | null;
  /** Обычные часы мастера в этот день (null — по графику выходной) */
  normal: { start: number; end: number } | null;
  /** Обычные рабочие часы — для выхода в выходной */
  usual: { start: number; end: number } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setBusy(true);
    const res = await fetch(`/api/${slug}/admin/absence?staffId=${staffId}&date=${date}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) router.refresh(); else setError((await res.json().catch(() => ({}))).error ?? 'Не получилось');
  }

  if (absence) {
    return (
      <div className="stack" style={{ gap: 4 }}>
        <button type="button" className="small" onClick={restore} disabled={busy}
          style={{ alignSelf: 'flex-start', border: 0, background: 'none', padding: 0, color: 'var(--accent-dark)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
          {busy ? 'Возвращаем…' : 'Вернуть обычный график'}
        </button>
        {error && <span className="small" style={{ color: 'var(--danger)' }}>{error}</span>}
      </div>
    );
  }
  if (!normal) {
    if (!usual) return null;
    return (
      <>
        <button type="button" className="small" onClick={() => setOpen(true)}
          style={{ alignSelf: 'flex-start', border: '1px solid #c9d6c0', background: 'var(--accent-soft)', borderRadius: 8, padding: '3px 8px', color: 'var(--accent-dark)', fontWeight: 700, cursor: 'pointer' }}>
          Выйдет в выходной…
        </button>
        {open && <ExtraDayDialog slug={slug} staffId={staffId} name={name} date={date} usual={usual} onClose={() => setOpen(false)} />}
      </>
    );
  }
  return (
    <>
      <button type="button" className="small" onClick={() => setOpen(true)}
        style={{ alignSelf: 'flex-start', border: '1px solid #e5c9cf', background: '#fbf3f4', borderRadius: 8, padding: '3px 8px', color: 'var(--danger)', fontWeight: 700, cursor: 'pointer' }}>
        Не выйдет…
      </button>
      {open && <AbsenceDialog slug={slug} staffId={staffId} name={name} date={date} normal={normal} onClose={() => setOpen(false)} />}
    </>
  );
}

function AbsenceDialog({ slug, staffId, name, date, normal, onClose }: {
  slug: string; staffId: string; name: string; date: string; normal: { start: number; end: number }; onClose: () => void;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(date);
  const [to, setTo] = useState(date);
  const [kind, setKind] = useState<'OFF' | 'HOURS'>('OFF');
  const [start, setStart] = useState(toTime(normal.start));
  const [end, setEnd] = useState(toTime(normal.end));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/${slug}/admin/absence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, from, to, kind, note, ...(kind === 'HOURS' ? { start: toMin(start), end: toMin(end) } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Не получилось'); return; }
    onClose(); router.refresh();
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`${name} не выйдет`} onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(23,35,28,.35)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="card stack" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, gap: 14 }}>
        <strong style={{ fontSize: 18 }}>{name} не выйдет</strong>
        <div className="grid2">
          <label className="field">С<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} /></label>
          <label className="field">По<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <div className="tabs" role="group" aria-label="На сколько">
          <button type="button" aria-pressed={kind === 'OFF'} onClick={() => setKind('OFF')}>Весь день</button>
          <button type="button" aria-pressed={kind === 'HOURS'} onClick={() => setKind('HOURS')}>Часть дня</button>
        </div>
        {kind === 'HOURS' && (
          <div className="grid2">
            <label className="field">Работает с<input type="time" step={300} value={start} onChange={(e) => setStart(e.target.value)} style={input} /></label>
            <label className="field">до<input type="time" step={300} value={end} onChange={(e) => setEnd(e.target.value)} style={input} /></label>
          </div>
        )}
        <label className="field">Причина (видят только сотрудники)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="заболела, семейные обстоятельства…" maxLength={200} />
        </label>
        <p className="small muted" style={{ margin: 0, lineHeight: 1.45 }}>
          Онлайн-запись к мастеру на это время сразу закроется. Клиенты, которые уже записаны, появятся в журнале списком — их можно передать другому мастеру, предупредить в WhatsApp или отменить запись.
        </p>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="row">
          <button type="button" className="btn" onClick={onClose}>Отмена</button>
          <button type="button" className="btn primary grow" disabled={busy} onClick={save}>{busy ? 'Сохраняем…' : 'Сохранить'}</button>
        </div>
      </div>
    </div>
  );
}

function ExtraDayDialog({ slug, staffId, name, date, usual, onClose }: {
  slug: string; staffId: string; name: string; date: string; usual: { start: number; end: number }; onClose: () => void;
}) {
  const router = useRouter();
  const [start, setStart] = useState(toTime(usual.start));
  const [end, setEnd] = useState(toTime(usual.end));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/${slug}/admin/absence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, from: date, to: date, kind: 'EXTRA', start: toMin(start), end: toMin(end), note }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Не получилось'); return; }
    onClose(); router.refresh();
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`${name} выйдет в выходной`} onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(23,35,28,.35)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="card stack" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, gap: 14 }}>
        <strong style={{ fontSize: 18 }}>{name} выйдет в свой выходной</strong>
        <div className="grid2">
          <label className="field">Работает с<input type="time" step={300} value={start} onChange={(e) => setStart(e.target.value)} style={input} /></label>
          <label className="field">до<input type="time" step={300} value={end} onChange={(e) => setEnd(e.target.value)} style={input} /></label>
        </div>
        <label className="field">Причина (видят только сотрудники)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="подменяет коллегу, поменялись выходными…" maxLength={200} />
        </label>
        <p className="small muted" style={{ margin: 0, lineHeight: 1.45 }}>
          В этот день к мастеру сразу откроется онлайн-запись. Если мастера поменялись выходными, отметьте у второго мастера «Не выйдет» на этот день.
        </p>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="row">
          <button type="button" className="btn" onClick={onClose}>Отмена</button>
          <button type="button" className="btn primary grow" disabled={busy} onClick={save}>{busy ? 'Сохраняем…' : 'Сохранить'}</button>
        </div>
      </div>
    </div>
  );
}

export type Conflict = {
  id: string; start: number; end: number; client: string; phone: string | null; service: string; master: string;
  alternatives: { id: string; name: string }[];
};

/** Клиенты, к которым мастер не выйдет: передать, предупредить или отменить */
export function ConflictList({ slug, salonName, dateLabel, items }: { slug: string; salonName: string; dateLabel: string; items: Conflict[] }) {
  if (!items.length) return null;
  return (
    <section className="card stack" style={{ borderColor: '#e5c9cf', background: '#fdf6f7', gap: 12 }} aria-labelledby="conflicts">
      <div>
        <h2 id="conflicts" style={{ fontSize: 18, color: 'var(--danger)' }}>Нужно решить: {items.length} {items.length === 1 ? 'запись' : items.length < 5 ? 'записи' : 'записей'}</h2>
        <p className="small muted" style={{ margin: '4px 0 0' }}>Мастер не выйдет в это время. Передайте клиента свободному мастеру или напишите ему и перенесите запись.</p>
      </div>
      {items.map((c) => <ConflictRow key={c.id} c={c} slug={slug} salonName={salonName} dateLabel={dateLabel} />)}
    </section>
  );
}

function ConflictRow({ c, slug, salonName, dateLabel }: { c: Conflict; slug: string; salonName: string; dateLabel: string }) {
  const router = useRouter();
  const [to, setTo] = useState(c.alternatives[0]?.id ?? '');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phone = c.phone?.replace(/\D/g, '') ?? '';
  const text = `Здравствуйте, ${c.client}! Это салон «${salonName}». К сожалению, ${c.master} ${dateLabel} не сможет выйти на работу. `
    + `Вы записаны на ${hhmm(c.start)} (${c.service}). Можем передать вас другому мастеру в это же время или перенести на другой день — как вам удобнее?`;

  async function act(kind: 'move' | 'cancel') {
    setBusy(true); setError(null);
    const res = await fetch(`/api/${slug}/admin/appointments/${c.id}`, kind === 'move'
      ? { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staffId: to }) }
      : { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Не получилось'); return; }
    router.refresh();
  }

  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 10, padding: '10px 0', borderTop: '1px solid #f0dde1' }}>
      <div className="grow" style={{ minWidth: 200 }}>
        <strong>{hhmm(c.start)}–{hhmm(c.end)} · {c.client}</strong>
        <div className="small muted">{c.service} · был у мастера {c.master}{c.phone ? ` · ${c.phone}` : ''}</div>
      </div>
      {c.alternatives.length ? (
        <div className="row" style={{ gap: 6 }}>
          <select aria-label="Кому передать" value={to} onChange={(e) => setTo(e.target.value)} style={input}>
            {c.alternatives.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button type="button" className="btn primary" style={{ minHeight: 44 }} disabled={busy} onClick={() => act('move')}>Передать</button>
        </div>
      ) : <span className="small muted">Свободных мастеров на это время нет</span>}
      {phone && (
        <a className="btn" style={{ minHeight: 44 }} target="_blank" rel="noreferrer" href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}>WhatsApp</a>
      )}
      {confirmCancel ? (
        <button type="button" className="btn" style={{ minHeight: 44, color: 'var(--danger)', borderColor: '#e5c9cf' }} disabled={busy} onClick={() => act('cancel')}>Точно отменить?</button>
      ) : (
        <button type="button" className="btn" style={{ minHeight: 44 }} onClick={() => setConfirmCancel(true)}>Отменить запись</button>
      )}
      {error && <div className="error" role="alert" style={{ width: '100%' }}>{error}</div>}
    </div>
  );
}
