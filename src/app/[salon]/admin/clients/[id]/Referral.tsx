'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Кто пригласил клиента и скольких он привёл; для пришедших без записи — отметить пригласившего по телефону */
export default function Referral({ slug, clientId, info, canSet, bonus }: {
  slug: string; clientId: string; canSet: boolean; bonus: number;
  info: { referrer: { id: string; name: string } | null; rewarded: boolean; invited: { id: string; name: string; came: boolean }[] };
}) {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (bonus <= 0 && !info.referrer && !info.invited.length) return null;
  async function save() {
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/${slug}/admin/clients/${clientId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ referrerPhone: phone }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(d.error ?? 'Не получилось'); return; }
    setPhone(''); router.refresh();
  }
  return (
    <section className="card stack" style={{ gap: 8 }}>
      <strong>🤝 Приглашения</strong>
      {info.referrer ? (
        <span className="small">Пришёл(ла) по приглашению: <Link href={`/${slug}/admin/clients/${info.referrer.id}`}>{info.referrer.name}</Link>
          {info.rewarded ? ` · ${info.referrer.name} получил(а) баллы` : ` · баллы ${info.referrer.name} начислятся после первой оплаты`}</span>
      ) : canSet && bonus > 0 ? (
        <div className="stack" style={{ gap: 6 }}>
          <span className="small muted">Новый клиент пришёл по совету знакомого? Укажите телефон того, кто пригласил, — после первой оплаты ему начислится {bonus} баллов.</span>
          <div className="row" style={{ gap: 8 }}>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Телефон пригласившего"
              style={{ minHeight: 42, flex: 1, minWidth: 0, borderRadius: 12, border: '1px solid #dde5de', padding: '0 12px', fontSize: 15 }} />
            <button type="button" className="btn" disabled={busy || phone.replace(/\D/g, '').length < 6} onClick={save} style={{ minHeight: 42 }}>Отметить</button>
          </div>
          {msg && <div className="error" role="alert">{msg}</div>}
        </div>
      ) : <span className="small muted">Пришёл(ла) сам(а), без приглашения.</span>}
      {info.invited.length > 0 && (
        <span className="small">Пригласил(а) друзей: <b>{info.invited.length}</b> — {info.invited.map((f, i) => (
          <span key={f.id}>{i ? ', ' : ''}<Link href={`/${slug}/admin/clients/${f.id}`}>{f.name}</Link>{f.came ? ' ✓' : ''}</span>
        ))}</span>
      )}
    </section>
  );
}
