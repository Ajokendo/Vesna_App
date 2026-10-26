'use client';

import { GROUPS, categoryGroup, type GroupId } from '@/lib/groups';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { Catalog } from '@/server/salon';
import type { HairLength } from '@/db/schema';
import { formatPrice, resolveService } from '@/lib/pricing';

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
      </div>
    );
  }

  const selectStyle = { minHeight: 48, borderRadius: 12, border: '1px solid #dde5de', padding: '0 12px', background: '#fff', fontSize: 15 } as const;
  return (
    <section className="card stack" style={{ maxWidth: 720 }}>
      <strong style={{ fontSize: 17 }}>{open === 'WALK_IN' ? 'Клиент без записи' : 'Новая запись'}{group ? ` · ${GROUPS.find((g) => g.id === group)?.name}` : ''}</strong>
      <label className="field">Услуга
        <select style={selectStyle} value={serviceId} onChange={(e) => { setServiceId(e.target.value); setStaffId(''); }}>
          <option value="">Выберите услугу</option>
          {catalog.categories.filter((c) => !group || categoryGroup(c) === group).map((c) => (
            <optgroup key={c.id} label={`${c.hall === 'MEN' ? 'Муж.' : 'Жен.'} · ${c.name}`}>
              {c.services.map((v) => {
                const r = resolveService(v, c.byLength ? length : null);
                return <option key={v.id} value={v.id} disabled={!r}>{v.name}{r ? ` — ${formatPrice(r.price, r.priceMax)}` : ''}</option>;
              })}
            </optgroup>
          ))}
        </select>
      </label>
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
