'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ManageData } from '@/server/manage';
import { Msg, inputSt, num, useSave } from './ui';

type Staff = ManageData['staff'][number];
type Cat = ManageData['categories'][number];
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const toTime = (m: number | null | undefined) => (m == null ? '' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
const fromTime = (t: string) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

/** Уменьшить фото на телефоне до квадрата 360×360 (≈30 КБ), чтобы не грузить сервер */
async function shrink(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const c = document.createElement('canvas');
  c.width = c.height = 360;
  c.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2.6, side, side, 0, 0, 360, 360);
  return c.toDataURL('image/jpeg', 0.85);
}

export default function StaffEditor({ slug, staff, categories, defaultCommission }: { slug: string; staff: Staff[]; categories: Cat[]; defaultCommission: number }) {
  const [adding, setAdding] = useState(false);
  const order = useSave(slug);
  const arrow = { width: 32, height: 28, borderRadius: 8, border: '1px solid var(--line)', background: '#fff', cursor: 'pointer', fontSize: 11, color: 'var(--muted)' } as const;
  function move(i: number, d: number) {
    const ids = staff.map((m) => m.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    order.save('order', { ids });
  }
  return (
    <div className="stack" style={{ gap: 12 }}>
      <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
        Здесь — кто работает, какие услуги делает и по какому графику. Разовые изменения (заболела, вышла в выходной) отмечайте в журнале кнопкой «Не выйдет / Выйдет».
        Стрелками ▲▼ задаётся порядок мастеров на главной, в записи и в журнале. PIN для кабинета мастера — на вкладке <Link href={`/${slug}/admin/settings?tab=pins`}>«PIN-коды»</Link>.
      </p>
      {staff.map((m, i) => (
        <div key={m.id} className="row" style={{ gap: 6, alignItems: 'stretch' }}>
          <div className="stack" style={{ gap: 4, justifyContent: 'center' }}>
            <button type="button" aria-label={`${m.name} выше`} disabled={i === 0 || order.busy} onClick={() => move(i, -1)} style={arrow}>▲</button>
            <button type="button" aria-label={`${m.name} ниже`} disabled={i === staff.length - 1 || order.busy} onClick={() => move(i, 1)} style={arrow}>▼</button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}><StaffCard slug={slug} m={m} categories={categories} defaultCommission={defaultCommission} /></div>
        </div>
      ))}
      {adding ? <StaffForm slug={slug} categories={categories} defaultCommission={defaultCommission} onDone={() => setAdding(false)} /> : (
        <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setAdding(true)}>+ Новый мастер</button>
      )}
    </div>
  );
}

function scheduleText(m: Staff) {
  const s = m.schedule;
  if (!s) return 'без графика';
  const days = s.kind === 'WEEKLY' ? s.weekdays.map((d) => DAYS[d]).join(', ') : `${s.cycleWork}/${s.cycleOff}`;
  return `${days} · ${toTime(s.startMinute)}–${toTime(s.endMinute)}`;
}

function StaffCard({ slug, m, categories, defaultCommission }: { slug: string; m: Staff; categories: Cat[]; defaultCommission: number }) {
  const [open, setOpen] = useState(false);
  if (open) return <StaffForm slug={slug} m={m} categories={categories} defaultCommission={defaultCommission} onDone={() => setOpen(false)} />;
  return (
    <button type="button" onClick={() => setOpen(true)} className="card row" style={{ gap: 12, textAlign: 'left', padding: '10px 14px', cursor: 'pointer', font: 'inherit', opacity: m.active ? 1 : 0.55 }}>
      <span className="avatar" style={{ width: 48, height: 48 }}>{m.photoUrl ? <img src={m.photoUrl} alt="" /> : m.name[0]}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong>{m.name}</strong>{m.active ? '' : ' · не работает'}
        <span className="small muted" style={{ display: 'block' }}>{m.title ?? ''}{m.roles.includes('MASTER') ? ` · ${scheduleText(m)}` : ' · не мастер'}</span>
      </span>
      <span className="small muted">✎</span>
    </button>
  );
}

function StaffForm({ slug, m, categories, defaultCommission, onDone }: { slug: string; m?: Staff; categories: Cat[]; defaultCommission: number; onDone: () => void }) {
  const isOwner = !!m?.roles.includes('OWNER');
  const sc = m?.schedule;
  const [f, setF] = useState({
    name: m?.name ?? '', title: m?.title ?? '', phone: m?.phone ?? '', isMaster: m ? m.roles.includes('MASTER') : true,
    commission: m?.commission == null ? '' : String(m.commission), active: m?.active ?? true, cats: new Set(m?.categoryIds ?? []), showRating: m?.showRating ?? false,
  });
  const [s, setS] = useState({
    kind: sc?.kind ?? 'WEEKLY', weekdays: new Set(sc?.weekdays ?? [0, 1, 2, 3, 4, 5]), cycleWork: String(sc?.cycleWork ?? 2), cycleOff: String(sc?.cycleOff ?? 2),
    cycleStart: sc?.cycleStart ?? new Date().toISOString().slice(0, 10), start: toTime(sc?.startMinute ?? 540), end: toTime(sc?.endMinute ?? 1140),
    bStart: toTime(sc?.breakStart), bEnd: toTime(sc?.breakEnd),
  });
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const { busy, msg, save, setMsg } = useSave(slug);
  const shown = photo === undefined ? m?.photoUrl : photo;

  async function submit() {
    const d = await save('staff', {
      id: m?.id, name: f.name.trim(), title: f.title.trim() || null, phone: f.phone.trim() || null, isMaster: f.isMaster,
      commission: num(f.commission), active: f.active, categoryIds: [...f.cats], photo, showRating: f.showRating,
      schedule: f.isMaster ? {
        kind: s.kind, weekdays: [...s.weekdays], cycleWork: num(s.cycleWork), cycleOff: num(s.cycleOff), cycleStart: s.kind === 'CYCLE' ? s.cycleStart : null,
        startMinute: fromTime(s.start), endMinute: fromTime(s.end), breakStart: fromTime(s.bStart), breakEnd: fromTime(s.bEnd),
      } : null,
    });
    if (d) onDone();
  }

  const box = { background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 14 } as const;
  return (
    <div className="stack" style={{ ...box, gap: 14 }}>
      <div className="row" style={{ gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="avatar" style={{ width: 72, height: 72, fontSize: 26 }}>{shown ? <img src={shown} alt="" /> : (f.name[0] ?? '?')}</span>
        <label className="btn" style={{ minHeight: 40, cursor: 'pointer' }}>
          {shown ? 'Заменить фото' : 'Загрузить фото'}
          <input type="file" accept="image/*" hidden onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            try { setPhoto(await shrink(file)); } catch { setMsg({ ok: false, text: 'Не удалось открыть фото — попробуйте другое (JPEG или PNG)' }); }
          }} />
        </label>
        {shown && <button type="button" className="small" style={{ border: 0, background: 'none', color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => setPhoto(null)}>убрать фото</button>}
      </div>
      <div className="grid2">
        <label className="field">Имя<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={inputSt} /></label>
        <label className="field">Специализация (видят клиенты)<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={inputSt} placeholder="например: Колорист, стилист" /></label>
        <label className="field">Телефон (необязательно)<input value={f.phone} inputMode="tel" onChange={(e) => setF({ ...f, phone: e.target.value })} style={inputSt} /></label>
        {!isOwner && (
          <label className="field">Доля мастера, %
            <input value={f.commission} inputMode="numeric" onChange={(e) => setF({ ...f, commission: e.target.value.replace(/\D/g, '') })} style={inputSt} placeholder={`как у всех: ${defaultCommission}`} />
          </label>
        )}
      </div>
      {isOwner && <p className="small muted" style={{ margin: 0 }}>Хозяйка салона: доля мастера не начисляется, весь доход — салону.</p>}
      <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={f.isMaster} onChange={(e) => setF({ ...f, isMaster: e.target.checked })} /> Принимает клиентов (мастер)</label>

      {f.isMaster && (<>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small" style={{ fontWeight: 800, marginBottom: 6 }}>Какие услуги делает</legend>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {categories.filter((c) => c.active || f.cats.has(c.id)).map((c) => (
              <label key={c.id} className="row small" style={{ gap: 6, border: '1px solid var(--line)', borderRadius: 999, padding: '6px 12px', background: f.cats.has(c.id) ? '#eef3ea' : '#fff' }}>
                <input type="checkbox" checked={f.cats.has(c.id)} onChange={(e) => { const n = new Set(f.cats); if (e.target.checked) n.add(c.id); else n.delete(c.id); setF({ ...f, cats: n }); }} />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack">
          <legend className="small" style={{ fontWeight: 800, marginBottom: 6 }}>График</legend>
          <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
            <label className="row small" style={{ gap: 6 }}><input type="radio" checked={s.kind === 'WEEKLY'} onChange={() => setS({ ...s, kind: 'WEEKLY' })} /> По дням недели</label>
            <label className="row small" style={{ gap: 6 }}><input type="radio" checked={s.kind === 'CYCLE'} onChange={() => setS({ ...s, kind: 'CYCLE' })} /> Сменами (2/2, 3/3…)</label>
          </div>
          {s.kind === 'WEEKLY' ? (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {DAYS.map((d, i) => {
                const on = s.weekdays.has(i);
                return (
                  <button key={d} type="button" aria-pressed={on} onClick={() => { const n = new Set(s.weekdays); if (on) n.delete(i); else n.add(i); setS({ ...s, weekdays: n }); }}
                    style={{ width: 46, height: 40, borderRadius: 10, border: '1px solid var(--line)', fontWeight: 800, cursor: 'pointer', background: on ? 'var(--accent-dark)' : '#fff', color: on ? '#fff' : 'var(--ink)' }}>{d}</button>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 8 }}>
              <label className="field">Дней работы<input inputMode="numeric" value={s.cycleWork} onChange={(e) => setS({ ...s, cycleWork: e.target.value.replace(/\D/g, '') })} style={inputSt} /></label>
              <label className="field">Дней отдыха<input inputMode="numeric" value={s.cycleOff} onChange={(e) => setS({ ...s, cycleOff: e.target.value.replace(/\D/g, '') })} style={inputSt} /></label>
              <label className="field">Первый рабочий день смены<input type="date" value={s.cycleStart} onChange={(e) => setS({ ...s, cycleStart: e.target.value })} style={inputSt} /></label>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginTop: 8 }}>
            <label className="field">Начало дня<input type="time" step={900} value={s.start} onChange={(e) => setS({ ...s, start: e.target.value })} style={inputSt} /></label>
            <label className="field">Конец дня<input type="time" step={900} value={s.end} onChange={(e) => setS({ ...s, end: e.target.value })} style={inputSt} /></label>
            <label className="field">Перерыв с<input type="time" step={900} value={s.bStart} onChange={(e) => setS({ ...s, bStart: e.target.value })} style={inputSt} /></label>
            <label className="field">Перерыв до<input type="time" step={900} value={s.bEnd} onChange={(e) => setS({ ...s, bEnd: e.target.value })} style={inputSt} /></label>
          </div>
          <span className="small muted">Перерыв необязателен. Новый график действует для будущих записей; уже сделанные записи не трогаются.</span>
        </fieldset>
      </>)}

      {f.isMaster && (
        <div className="stack" style={{ gap: 4, background: '#fbf6ea', border: '1px solid var(--gold)', borderRadius: 12, padding: 10 }}>
          <label className="row small" style={{ gap: 6, fontWeight: 700 }}><input type="checkbox" checked={f.showRating} onChange={(e) => setF({ ...f, showRating: e.target.checked })} /> Показывать клиентам рейтинг мастера</label>
          <span className="small muted">{m?.rating ? `Сейчас: ★ ${m.rating.avg.toFixed(1).replace('.', ',')} · оценок: ${m.rating.count}` : 'Оценок пока нет'}. Клиенты увидят рейтинг, когда наберётся не меньше 10 оценок.</span>
        </div>
      )}
      {!isOwner && m && (
        <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={!f.active} onChange={(e) => setF({ ...f, active: !e.target.checked })} /> Больше не работает в салоне (скрыть из записи; история сохранится)</label>
      )}
      <div className="row">
        <button type="button" className="btn primary" style={{ minHeight: 42 }} disabled={busy} onClick={submit}>{busy ? '…' : 'Сохранить'}</button>
        <button type="button" className="btn" style={{ minHeight: 42 }} onClick={onDone}>Отмена</button>
        <Msg msg={msg} />
      </div>
    </div>
  );
}
