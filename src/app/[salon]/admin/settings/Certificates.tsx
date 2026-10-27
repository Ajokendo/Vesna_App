'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatSom } from '@/lib/pricing';
import { inputSt } from './ui';
import Hints from '@/app/Hints';

type Row = {
  id: string; code: string; amount: number; balance: number; toName: string | null; fromName: string | null; buyerPhone: string | null;
  sold: string; expires: string; status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED'; statusName: string;
};

const AMOUNTS = [1000, 2000, 3000, 5000];
const METHODS = [{ id: 'CASH', name: 'Наличные' }, { id: 'CARD', name: 'Карта' }, { id: 'QR', name: 'QR / банк' }] as const;

/** Вкладка «Сертификаты»: включить/выключить, выпустить сертификат после оплаты, список выпущенных */
export default function Certificates({ slug, salonName, enabled, months, rows, origin }: {
  slug: string; salonName: string; enabled: boolean; months: number; rows: Row[]; origin: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [m, setM] = useState(String(months));
  const [f, setF] = useState({ amount: '2000', toName: '', fromName: '', buyerPhone: '', method: 'CASH' as 'CASH' | 'CARD' | 'QR' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [made, setMade] = useState<{ code: string } | null>(null);
  const [q, setQ] = useState('');

  async function post(body: unknown) {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/${slug}/admin/certificates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? 'Не получилось' }); return null; }
    router.refresh();
    return d;
  }
  async function saveSettings(next: boolean) {
    const d = await post({ action: 'settings', data: { enabled: next, months: Number(m) || 12 } });
    if (d) { setOn(next); setMsg({ ok: true, text: next ? '✓ Сертификаты включены' : '✓ Сертификаты выключены' }); }
  }
  async function issue() {
    const d = await post({ action: 'issue', data: { amount: Number(f.amount), toName: f.toName || null, fromName: f.fromName || null, buyerPhone: f.buyerPhone || null, method: f.method } });
    if (d) { setMade({ code: d.code }); setF({ ...f, toName: '', fromName: '', buyerPhone: '' }); }
  }
  const link = (code: string) => `${origin}/${slug}/c/${code}`;
  const wa = (code: string, phone?: string | null) => {
    const text = `Подарочный сертификат салона «${salonName}»: ${link(code)}`;
    const d = phone?.replace(/\D/g, '');
    return `https://wa.me/${d ?? ''}?text=${encodeURIComponent(text)}`;
  };
  const shown = rows.filter((r) => !q || [r.code, r.toName, r.fromName, r.buyerPhone].some((x) => x?.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="stack" style={{ gap: 14 }}>
      <section className="card stack" style={{ gap: 10, borderColor: 'var(--gold)' }}>
        <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={on} disabled={busy} onChange={(e) => saveSettings(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
          <span><b>Подарочные сертификаты</b><br /><Hints style={{ marginTop: 4 }} items={[
            ['✅', 'Включено: клиенты видят раздел в «Ещё», здесь появляется выпуск'],
            ['⏸', 'Выключено: проданные сертификаты всё равно принимаются до конца срока'],
          ]} /></span>
        </label>
        <label className="field" style={{ maxWidth: 260 }}>Срок действия новых, месяцев
          <input inputMode="numeric" value={m} onChange={(e) => setM(e.target.value.replace(/\D/g, ''))} onBlur={() => on && Number(m) !== months && saveSettings(true)} style={inputSt} />
        </label>
        {msg && (msg.ok ? <span className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>{msg.text}</span> : <div className="error" role="alert">{msg.text}</div>)}
      </section>

      {on && (
        <section className="card stack" style={{ gap: 10 }}>
          <strong style={{ fontSize: 17 }}>🎁 Выпустить сертификат</strong>
          <Hints items={[['1️⃣', 'Примите оплату'], ['2️⃣', 'Выпустите сертификат — он появится в «Кассе» за сегодня']]} />
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {AMOUNTS.map((a) => (
              <button key={a} type="button" className="btn" aria-pressed={f.amount === String(a)} onClick={() => setF({ ...f, amount: String(a) })}
                style={{ minHeight: 40, fontSize: 14, background: f.amount === String(a) ? 'var(--accent)' : undefined, color: f.amount === String(a) ? '#fff' : undefined }}>{formatSom(a)}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            <label className="field">Сумма, сом<input inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} style={inputSt} /></label>
            <label className="field">Кому (имя)<input value={f.toName} onChange={(e) => setF({ ...f, toName: e.target.value })} placeholder="необязательно" style={inputSt} /></label>
            <label className="field">От кого<input value={f.fromName} onChange={(e) => setF({ ...f, fromName: e.target.value })} placeholder="необязательно" style={inputSt} /></label>
            <label className="field">Телефон покупателя<input type="tel" value={f.buyerPhone} onChange={(e) => setF({ ...f, buyerPhone: e.target.value })} placeholder="для связи" style={inputSt} /></label>
          </div>
          <div className="tabs" role="group" aria-label="Как оплачен">
            {METHODS.map((x) => <button key={x.id} type="button" aria-pressed={f.method === x.id} onClick={() => setF({ ...f, method: x.id })}>{x.name}</button>)}
          </div>
          <button type="button" className="btn primary" disabled={busy || Number(f.amount) < 100} onClick={issue} style={{ alignSelf: 'flex-start' }}>
            {busy ? 'Выпускаем…' : `Выпустить на ${formatSom(Number(f.amount) || 0)}`}
          </button>
          {made && (
            <div className="note stack" style={{ gap: 8 }}>
              <span>✓ Сертификат <b style={{ letterSpacing: 1 }}>{made.code}</b> выпущен.</span>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <a className="btn" href={`/${slug}/c/${made.code}`} target="_blank" rel="noreferrer" style={{ minHeight: 40, fontSize: 14 }}>Открыть / распечатать</a>
                <a className="btn" href={wa(made.code)} target="_blank" rel="noreferrer" style={{ minHeight: 40, fontSize: 14 }}>Отправить в WhatsApp</a>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <strong>Выпущенные сертификаты ({rows.length})</strong>
          {rows.length > 5 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Код, имя, телефон" aria-label="Поиск сертификата" style={{ ...inputSt, maxWidth: 220 }} />}
        </div>
        {!rows.length && <span className="muted">Пока нет.</span>}
        {shown.map((r) => (
          <div key={r.id} className="row" style={{ gap: 10, borderTop: '1px solid var(--line)', paddingTop: 8, flexWrap: 'wrap', opacity: r.status === 'ACTIVE' ? 1 : 0.6 }}>
            <span className="grow stack" style={{ gap: 1, minWidth: 180 }}>
              <span><b style={{ letterSpacing: 1 }}>{r.code}</b> · {formatSom(r.amount)}{r.balance !== r.amount && r.status !== 'CANCELLED' ? <> · осталось <b>{formatSom(r.balance)}</b></> : ''}</span>
              <span className="small muted">{[r.toName && `кому: ${r.toName}`, r.fromName && `от: ${r.fromName}`, `продан ${r.sold}`, `до ${r.expires}`].filter(Boolean).join(' · ')}</span>
              <span className="small" style={{ fontWeight: 700, color: r.status === 'ACTIVE' ? 'var(--accent-dark)' : 'var(--muted)' }}>{r.statusName}</span>
            </span>
            <a className="btn" href={`/${slug}/c/${r.code}`} target="_blank" rel="noreferrer" style={{ minHeight: 36, fontSize: 13, padding: '0 10px' }}>Открыть</a>
            {r.status === 'ACTIVE' && <a className="btn" href={wa(r.code, r.buyerPhone)} target="_blank" rel="noreferrer" style={{ minHeight: 36, fontSize: 13, padding: '0 10px' }}>WhatsApp</a>}
            {r.status === 'ACTIVE' && r.balance === r.amount && (
              <button type="button" className="btn" disabled={busy} onClick={() => { if (confirm(`Аннулировать сертификат ${r.code}? Деньги покупателю возвращаете вы.`)) post({ action: 'cancel', id: r.id }); }}
                style={{ minHeight: 36, fontSize: 13, padding: '0 10px', color: 'var(--danger)' }}>Аннулировать</button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
