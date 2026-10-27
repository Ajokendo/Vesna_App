'use client';

import { useActionState } from 'react';

export default function PinChange({ action }: { action: (prev: string | null, fd: FormData) => Promise<string | null> }) {
  const [res, formAction, pending] = useActionState(action, null);
  const f = { minHeight: 44, borderRadius: 12, border: '1px solid #dde5de', padding: '0 12px', fontSize: 16, width: '100%', minWidth: 0 } as const;
  return (
    <form action={formAction} className="stack" style={{ gap: 8 }}>
      <span className="small muted">Новый PIN директора (4–6 цифр), не такой, как у администратора.</span>
      <div className="row" style={{ gap: 8 }}>
        <input name="pin" type="password" inputMode="numeric" pattern="\d{4,6}" required placeholder="новый PIN" aria-label="Новый PIN" style={f} />
        <input name="pin2" type="password" inputMode="numeric" pattern="\d{4,6}" required placeholder="ещё раз" aria-label="PIN ещё раз" style={f} />
      </div>
      {res === 'ok' ? <span className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>✓ PIN изменён</span> : res && <div className="error" role="alert">{res}</div>}
      <button type="submit" className="btn" disabled={pending} style={{ alignSelf: 'flex-start', minHeight: 42 }}>{pending ? 'Сохраняем…' : 'Сменить PIN'}</button>
    </form>
  );
}
