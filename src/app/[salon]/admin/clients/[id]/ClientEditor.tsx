'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const inp = { minHeight: 44, borderRadius: 12, border: '1px solid #dde5de', padding: '0 12px', fontSize: 16, background: '#fff', width: '100%' } as const;

/** Имя, телефон, день рождения и заметка администратора */
export default function ClientEditor({ slug, c, child }: {
  slug: string; child: boolean;
  c: { id: string; name: string; phone: string | null; birthDate: string | null; note: string | null };
}) {
  const router = useRouter();
  const [f, setF] = useState({ name: c.name, phone: c.phone ?? '', birthDate: c.birthDate ?? '', note: c.note ?? '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = f.name !== c.name || f.phone !== (c.phone ?? '') || f.birthDate !== (c.birthDate ?? '') || f.note !== (c.note ?? '');

  async function save() {
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/${slug}/admin/clients/${c.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: f.name, phone: f.phone || null, birthDate: f.birthDate || null, note: f.note || null }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: d.error ?? 'Не получилось' }); return; }
    setMsg({ ok: true, text: '✓ Сохранено' });
    router.refresh();
  }

  return (
    <section className="card stack" style={{ gap: 12 }} aria-label="Данные клиента">
      <label className="field">Заметка (видят только сотрудники)
        <textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} rows={3}
          placeholder="например: аллергия на аммиак, любит Диану, приходит с ребёнком"
          style={{ ...inp, minHeight: 80, padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit' }} />
      </label>
      <div className="grid2">
        <label className="field">Имя<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={inp} /></label>
        {!child && <label className="field">Телефон<input value={f.phone} inputMode="tel" onChange={(e) => setF({ ...f, phone: e.target.value })} style={inp} /></label>}
        <label className="field">День рождения<input type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} style={inp} /></label>
      </div>
      <div className="row">
        <button type="button" className="btn primary" disabled={!dirty || busy} onClick={save} style={{ minHeight: 44 }}>{busy ? 'Сохраняем…' : 'Сохранить'}</button>
        {msg && (msg.ok ? <span className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>{msg.text}</span> : <div className="error" role="alert">{msg.text}</div>)}
      </div>
    </section>
  );
}
