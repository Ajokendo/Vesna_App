'use client';

import { useState } from 'react';
import type { ManageData } from '@/server/manage';
import { Msg, inputSt, num, useSave } from './ui';

type Cat = ManageData['categories'][number];
type Svc = Cat['services'][number];
const LENGTHS = [['SHORT', 'Короткие'], ['MEDIUM', 'Средние'], ['LONG', 'Длинные'], ['XLONG', 'Очень длинные']] as const;
type LKey = (typeof LENGTHS)[number][0];

const cell = { ...inputSt, minHeight: 38, fontSize: 14, padding: '0 8px' };
const s = (v: number | null | undefined) => (v == null ? '' : String(v));

/** Услуги и цены по разделам: изменить, добавить, скрыть */
export default function ServicesEditor({ slug, categories }: { slug: string; categories: Cat[] }) {
  const [newCat, setNewCat] = useState(false);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
        Длительность — сколько минут занимает услуга (по ней считается свободное время). «Выдержка» — для окрашивания: через сколько минут от начала
        начинается выдержка и сколько она длится; в это время мастер свободен. Скрытые услуги и разделы клиенты не видят, история записей сохраняется.
      </p>
      {categories.map((c) => <CategoryCard key={c.id} slug={slug} c={c} />)}
      {newCat ? <CategoryForm slug={slug} onDone={() => setNewCat(false)} /> : (
        <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setNewCat(true)}>+ Новый раздел услуг</button>
      )}
    </div>
  );
}

function CategoryCard({ slug, c }: { slug: string; c: Cat }) {
  const [edit, setEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  return (
    <details className="card" style={{ padding: '12px 16px', opacity: c.active ? 1 : 0.6 }}>
      <summary style={{ cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 16 }}>{c.name}</strong>
        <span className="small muted">{c.hall === 'MEN' ? 'мужской зал' : 'женский зал'}{c.byLength ? ' · цена по длине волос' : ''}{c.forKids ? ' · детский' : ''} · услуг: {c.services.length}{c.active ? '' : ' · скрыт'}</span>
      </summary>
      <div className="stack" style={{ gap: 10, marginTop: 12 }}>
        {edit ? <CategoryForm slug={slug} c={c} onDone={() => setEdit(false)} /> : (
          <button type="button" className="small" onClick={() => setEdit(true)} style={{ alignSelf: 'flex-start', border: 0, background: 'none', padding: 0, color: 'var(--accent-dark)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>Изменить раздел</button>
        )}
        {c.services.map((v) => <ServiceRow key={v.id} slug={slug} c={c} v={v} />)}
        {adding ? <ServiceRow slug={slug} c={c} onDone={() => setAdding(false)} /> : (
          <button type="button" className="btn" style={{ alignSelf: 'flex-start', minHeight: 38 }} onClick={() => setAdding(true)}>+ Добавить услугу</button>
        )}
      </div>
    </details>
  );
}

function CategoryForm({ slug, c, onDone }: { slug: string; c?: Cat; onDone: () => void }) {
  const [v, setV] = useState({ name: c?.name ?? '', hall: c?.hall ?? 'WOMEN', note: c?.note ?? '', byLength: c?.byLength ?? false, forKids: c?.forKids ?? false, active: c?.active ?? true });
  const { busy, msg, save } = useSave(slug);
  return (
    <div className="stack" style={{ gap: 10, background: 'var(--ground)', borderRadius: 12, padding: 12 }}>
      <div className="grid2">
        <label className="field">Название раздела<input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} style={inputSt} /></label>
        <label className="field">Зал
          <select value={v.hall} onChange={(e) => setV({ ...v, hall: e.target.value as 'MEN' | 'WOMEN' })} style={inputSt}>
            <option value="WOMEN">Женский</option><option value="MEN">Мужской</option>
          </select>
        </label>
      </div>
      <label className="field">Пояснение для клиентов (необязательно)<input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} style={inputSt} placeholder="например: краска оплачивается отдельно" /></label>
      <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
        <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={v.byLength} disabled={!!c} onChange={(e) => setV({ ...v, byLength: e.target.checked })} /> Цена зависит от длины волос{c ? ' (меняется только при создании)' : ''}</label>
        <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={v.forKids} onChange={(e) => setV({ ...v, forKids: e.target.checked })} /> Детский (цена по возрасту)</label>
        <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={!v.active} onChange={(e) => setV({ ...v, active: !e.target.checked })} /> Скрыть от клиентов</label>
      </div>
      <div className="row">
        <button type="button" className="btn primary" style={{ minHeight: 40 }} disabled={busy} onClick={async () => { if (await save('category', { ...v, id: c?.id, note: v.note || null })) onDone(); }}>{busy ? '…' : 'Сохранить раздел'}</button>
        <button type="button" className="btn" style={{ minHeight: 40 }} onClick={onDone}>Отмена</button>
        <Msg msg={msg} />
      </div>
    </div>
  );
}

function ServiceRow({ slug, c, v, onDone }: { slug: string; c: Cat; v?: Svc; onDone?: () => void }) {
  const [f, setF] = useState({
    name: v?.name ?? '', price: s(v?.price), priceMax: s(v?.priceMax), dur: s(v?.durationMin), label: v?.durationLabel ?? '',
    pa: s(v?.pauseAfterMin), pm: s(v?.pauseMin), ageMin: s(v?.ageMin), ageMax: s(v?.ageMax), active: v?.active ?? true,
  });
  const [bl, setBl] = useState<Record<LKey, { price: string; max: string; dur: string; pa: string; pm: string }>>(() => Object.fromEntries(LENGTHS.map(([k]) => {
    const x = v?.byLength?.[k];
    return [k, { price: s(x?.price), max: s(x?.max), dur: s(x?.dur), pa: s(x?.pa), pm: s(x?.pm) }];
  })) as Record<LKey, { price: string; max: string; dur: string; pa: string; pm: string }>);
  const [open, setOpen] = useState(!v);
  const { busy, msg, save } = useSave(slug);
  const d = (x: string) => x.replace(/\D/g, '');

  async function submit() {
    const byLength = c.byLength ? Object.fromEntries(LENGTHS.flatMap(([k]) => {
      const x = bl[k];
      if (!x.price || !x.dur) return [];
      return [[k, { price: Number(x.price), max: num(x.max), dur: Number(x.dur), pa: num(x.pa), pm: num(x.pm) }]];
    })) : null;
    const ok = await save('service', {
      id: v?.id, categoryId: c.id, name: f.name.trim(), price: num(f.price), priceMax: num(f.priceMax), durationMin: num(f.dur),
      durationLabel: f.label.trim() || null, pauseAfterMin: num(f.pa), pauseMin: num(f.pm), byLength,
      ageMin: num(f.ageMin), ageMax: num(f.ageMax), active: f.active,
    });
    if (ok && !v) onDone?.();
    if (ok && v) setOpen(false);
  }

  const summary = c.byLength
    ? LENGTHS.filter(([k]) => v?.byLength?.[k]).map(([k, n]) => `${n.toLowerCase()} ${v!.byLength![k]!.price}`).join(' · ')
    : `${v?.price ?? ''}${v?.priceMax ? `–${v.priceMax}` : ''} сом · ${v?.durationMin ?? ''} мин${v?.pauseMin ? ` · выдержка ${v.pauseMin}` : ''}`;
  if (v && !open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="row" style={{ justifyContent: 'space-between', textAlign: 'left', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px', background: '#fff', cursor: 'pointer', font: 'inherit', opacity: v.active ? 1 : 0.55 }}>
        <span><strong>{v.name}</strong>{v.active ? '' : ' · скрыта'}</span>
        <span className="small muted">{summary} ✎</span>
      </button>
    );
  }
  return (
    <div className="stack" style={{ gap: 10, border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: '#fff' }}>
      <label className="field">Название услуги<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={inputSt} /></label>
      {c.byLength ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560, fontSize: 13 }}>
            <thead><tr className="muted" style={{ textAlign: 'left' }}><th style={{ padding: 4 }}>Длина</th><th>Цена</th><th>Цена «до»</th><th>Минут</th><th>Выдержка с, мин</th><th>Выдержка, мин</th></tr></thead>
            <tbody>
              {LENGTHS.map(([k, n]) => (
                <tr key={k}>
                  <td style={{ padding: 4, fontWeight: 700 }}>{n}</td>
                  {(['price', 'max', 'dur', 'pa', 'pm'] as const).map((fk) => (
                    <td key={fk} style={{ padding: 2 }}><input inputMode="numeric" value={bl[k][fk]} onChange={(e) => setBl({ ...bl, [k]: { ...bl[k], [fk]: d(e.target.value) } })} style={cell} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <span className="small muted">Пустая строка — для этой длины услуги нет.</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          <label className="field">Цена, сом<input inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: d(e.target.value) })} style={cell} /></label>
          <label className="field">Цена «до» (если от–до)<input inputMode="numeric" value={f.priceMax} onChange={(e) => setF({ ...f, priceMax: d(e.target.value) })} style={cell} /></label>
          <label className="field">Длительность, мин<input inputMode="numeric" value={f.dur} onChange={(e) => setF({ ...f, dur: d(e.target.value) })} style={cell} /></label>
          <label className="field">Выдержка с, мин<input inputMode="numeric" value={f.pa} onChange={(e) => setF({ ...f, pa: d(e.target.value) })} style={cell} /></label>
          <label className="field">Выдержка, мин<input inputMode="numeric" value={f.pm} onChange={(e) => setF({ ...f, pm: d(e.target.value) })} style={cell} /></label>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
        <label className="field">Как писать время клиенту (необязательно)<input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} style={cell} placeholder="например: 1,5–2 ч" /></label>
        {c.forKids && <label className="field">Возраст от<input inputMode="numeric" value={f.ageMin} onChange={(e) => setF({ ...f, ageMin: d(e.target.value) })} style={cell} /></label>}
        {c.forKids && <label className="field">Возраст до<input inputMode="numeric" value={f.ageMax} onChange={(e) => setF({ ...f, ageMax: d(e.target.value) })} style={cell} /></label>}
      </div>
      <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={!f.active} onChange={(e) => setF({ ...f, active: !e.target.checked })} /> Скрыть от клиентов</label>
      <div className="row">
        <button type="button" className="btn primary" style={{ minHeight: 40 }} disabled={busy} onClick={submit}>{busy ? '…' : 'Сохранить'}</button>
        <button type="button" className="btn" style={{ minHeight: 40 }} onClick={() => (v ? setOpen(false) : onDone?.())}>Отмена</button>
        <Msg msg={msg} />
      </div>
    </div>
  );
}
