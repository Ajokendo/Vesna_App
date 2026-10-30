'use client';

import { GROUPS, categoryGroup, type GroupId } from '@/lib/groups';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { Catalog } from '@/server/salon';
import type { HairLength } from '@/db/schema';
import { formatPrice, resolveService } from '@/lib/pricing';
import Tip from '@/app/Tip';

const LENGTHS: { id: HairLength; name: string }[] = [
  { id: 'SHORT', name: 'Короткие' }, { id: 'MEDIUM', name: 'Средние' }, { id: 'LONG', name: 'Длинные' }, { id: 'XLONG', name: 'Очень длинные' },
];

/** Быстрая запись с ресепшн: по телефону или клиент «с улицы» */
export default function NewAppointment({ slug, date, catalog, group }: { slug: string; date: string; catalog: Catalog; group?: GroupId }) {
  const router = useRouter();
  const [open, setOpen] = useState<null | 'ADMIN' | 'WALK_IN'>(null);
  const [serviceId, setServiceId] = useState('');
  const [length, setLength] = useState<HairLength>('MEDIUM');
  const [staffId, setStaffId] = useState('');
  const [time, setTime] = useState('');
  const [client, setClient] = useState({ name: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const category = catalog.categories.find((c) => c.services.some((v) => v.id === serviceId));
  const service = category?.services.find((v) => v.id === serviceId);
  const masters = useMemo(() => {
    if (!category || !service) return [];
    return catalog.staff.filter((m) => category.staffIds.includes(m.id) && (!service.onlyStaffIds.length || service.onlyStaffIds.includes(m.id)));
  }, [catalog, category, service]);

  async function save() {
    setBusy(true); setError(null);
    const [h, m] = time.split(':').map(Number);
    const res = await fetch(`/api/${slug}/admin/appointments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId, staffId, length: category?.byLength ? length : null, addonIds: [], date, minute: h * 60 + m,
        client: { name: client.name || 'Клиент без записи', phone: client.phone }, source: open,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Не получилось'); return; }
    setOpen(null); setServiceId(''); setStaffId(''); setTime(''); setClient({ name: '', phone: '' });
    router.refresh();
  }

  if (!open) {
    return (
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn primary" onClick={() => setOpen('ADMIN')}>+ Запись</button>
        <button type="button" className="btn" style={{ background: 'var(--cream)', borderColor: 'var(--gold)' }} onClick={() => { setOpen('WALK_IN'); const d = new Date(); setTime(`${String(d.getHours()).padStart(2, '0')}:${String(Math.ceil(d.getMinutes() / 5) * 5 % 60).padStart(2, '0')}`); }}>+ Без записи</button>
        <span style={{ alignSelf: 'center' }}><Tip slug={slug} help="new" text={<>«+ Запись» — клиент позвонил или написал: выберите время.<br />«+ Без записи» — клиент пришёл с улицы: запись сразу на сейчас.</>} /></span>
      </div>
    );
  }

  const selectStyle = { minHeight: 48, borderRadius: 12, border: '1px solid #dde5de', padding: '0 12px', background: '#fff', fontSize: 15 } as const;
  return (
    <section className="card stack" style={{ maxWidth: 720 }}>
      <strong style={{ fontSize: 17 }}>{open === 'WALK_IN' ? 'Клиент без записи' : 'Новая запись'}{group ? ` · ${GROUPS.find((g) => g.id === group)?.name}` : ''}</strong>
      <div className="field">Услуга
        <ServicePicker categories={catalog.categories.filter((c) => !group || categoryGroup(c) === group)} length={length} value={serviceId}
          lengthName={LENGTHS.find((l) => l.id === length)?.name ?? ''} onChange={(id) => { setServiceId(id); setStaffId(''); }} />
      </div>
      {category?.byLength && (
        <label className="field">Длина волос
          <select style={selectStyle} value={length} onChange={(e) => setLength(e.target.value as HairLength)}>
            {LENGTHS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      )}
      <div className="grid2">
        <label className="field">Мастер
          <select style={selectStyle} value={staffId} onChange={(e) => setStaffId(e.target.value)} disabled={!service}>
            <option value="">Выберите</option>
            {masters.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label className="field">Время<input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <div className="grid2">
        <label className="field">Имя клиента<input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} /></label>
        <label className="field">Телефон<input type="tel" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} placeholder={open === 'WALK_IN' ? 'необязательно' : '+996'} /></label>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="row">
        <button type="button" className="btn primary" disabled={busy || !serviceId || !staffId || !time || (open === 'ADMIN' && client.phone.replace(/\D/g, '').length < 9)} onClick={save}>{busy ? 'Сохраняем…' : 'Сохранить'}</button>
        <button type="button" className="btn" onClick={() => setOpen(null)}>Отмена</button>
      </div>
    </section>
  );
}

type PickerCat = Catalog['categories'][number];
const nb = (s: string) => s.replace(/ /g, '\u00a0');

/** Выбор услуги: список по разделам, название слева, цена справа (с разделителем тысяч), поиск по названию */
function ServicePicker({ categories, length, lengthName, value, onChange }: {
  categories: PickerCat[]; length: HairLength; lengthName: string; value: string; onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const cat = categories.find((c) => c.services.some((v) => v.id === value));
  const svc = cat?.services.find((v) => v.id === value);
  const r = svc && cat ? resolveService(svc, cat.byLength ? length : null) : null;
  const query = q.trim().toLowerCase();
  const list = categories.map((c) => ({ c, items: c.services.filter((v) => !query || v.name.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)) }))
    .filter((x) => x.items.length);
  const many = new Set(categories.map((c) => c.hall)).size > 1;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{
        minHeight: 48, borderRadius: 12, border: '1px solid #dde5de', padding: '6px 12px', background: '#fff', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 10, textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%',
      }}>
        {svc ? (
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{svc.name}</span>
            <span className="small muted" style={{ fontWeight: 500 }}>{cat?.name}</span>
          </span>
        ) : <span className="muted" style={{ fontWeight: 600 }}>Выберите услугу</span>}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
          {r && <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: 14 }}>{nb(formatPrice(r.price, r.priceMax))}</span>}
          <span aria-hidden className="muted">▾</span>
        </span>
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Выбор услуги" onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(23,35,28,.35)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{
            width: '100%', maxWidth: 560, maxHeight: '86dvh', display: 'flex', flexDirection: 'column', padding: 0, fontWeight: 500, borderRadius: '20px 20px 0 0', overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--line)' }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ fontSize: 17 }}>Услуга</strong>
                <button type="button" onClick={() => setOpen(false)} className="small" style={{ border: 0, background: 'none', color: 'var(--muted)', cursor: 'pointer', fontWeight: 700 }}>Закрыть</button>
              </div>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию" aria-label="Поиск услуги"
                style={{ minHeight: 42, width: '100%', borderRadius: 12, border: '1px solid #dde5de', padding: '0 12px', fontSize: 15 }} />
              {categories.some((c) => c.byLength) && <span className="small muted" style={{ display: 'block', marginTop: 6 }}>Цены по длине волос — для «{lengthName.toLowerCase()}»; длину можно сменить после выбора.</span>}
            </div>
            <div style={{ overflowY: 'auto', padding: '4px 0 calc(12px + env(safe-area-inset-bottom))' }}>
              {list.map(({ c, items }) => (
                <section key={c.id}>
                  <div style={{ position: 'sticky', top: 0, background: 'var(--ground)', padding: '7px 16px', fontSize: 12, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                    {c.name}{many ? ` · ${c.hall === 'MEN' ? 'муж.' : 'жен.'}` : ''}
                  </div>
                  {items.map((v) => {
                    const rr = resolveService(v, c.byLength ? length : null);
                    const on = v.id === value;
                    return (
                      <button key={v.id} type="button" disabled={!rr} onClick={() => { onChange(v.id); setOpen(false); setQ(''); }} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, width: '100%', padding: '10px 16px', border: 0,
                        borderBottom: '1px solid var(--line)', background: on ? 'var(--accent-soft)' : '#fff', textAlign: 'left', cursor: rr ? 'pointer' : 'default', font: 'inherit',
                        opacity: rr ? 1 : 0.45,
                      }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 14, fontWeight: on ? 800 : 600, lineHeight: 1.3 }}>{v.name}</span>
                          {rr && <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{rr.durationLabel ?? `${rr.durationMin} мин`}{rr.pause ? ' · с выдержкой' : ''}</span>}
                        </span>
                        <span style={{ flex: '0 0 auto', fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)', textAlign: 'right' }}>
                          {rr ? nb(formatPrice(rr.price, rr.priceMax)) : 'нет для этой длины'}
                        </span>
                      </button>
                    );
                  })}
                </section>
              ))}
              {!list.length && <p className="muted" style={{ padding: 16, margin: 0 }}>Ничего не нашли</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
