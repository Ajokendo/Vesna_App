'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export const inputSt = { minHeight: 42, borderRadius: 10, border: '1px solid #dde5de', padding: '0 10px', fontSize: 15, background: '#fff', width: '100%' } as const;

/** Число из поля ввода: пусто → null */
export const num = (v: string) => (v.trim() === '' ? null : Number(v));

/** Отправка в API настроек с сообщением «Сохранено» / ошибкой */
export function useSave(slug: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function save(kind: 'salon' | 'service' | 'category' | 'staff' | 'order', data: unknown) {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/${slug}/admin/manage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, data }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? 'Не получилось' }); return null; }
    setMsg({ ok: true, text: '✓ Сохранено' });
    router.refresh();
    return d;
  }
  return { busy, msg, save, setMsg };
}

export function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return msg.ok ? <span className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>{msg.text}</span> : <div className="error" role="alert">{msg.text}</div>;
}
