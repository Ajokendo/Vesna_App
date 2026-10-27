'use client';

import { useEffect, useState } from 'react';
import { disable, enable, humanError, login, saved, supported, type Role } from './passkey-client';

const FINGER = 'M12 11v3M8.5 8.8A4.5 4.5 0 0 1 16.5 11v2.5M7.5 12v2a8 8 0 0 0 1.2 4.2M12 5a7 7 0 0 1 7 7v1.5M5 12.5V12a7 7 0 0 1 3-5.7M15.5 16a11 11 0 0 1-1.3 4M12 17.5V19';

export function FingerIcon({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={FINGER} /></svg>;
}

/** Переключатель «Входить по отпечатку / Face ID на этом телефоне» (по умолчанию выключен) */
export function PasskeyToggle({ slug, role, sub, hint }: { slug: string; role: Role; sub?: string | null; hint?: string }) {
  const [ok, setOk] = useState<boolean | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    supported().then(setOk);
    setOn(saved(slug, role).some((x) => sub === undefined || x.sub === sub));
  }, [slug, role, sub]);
  if (!ok) return null;
  async function toggle() {
    setBusy(true); setErr(null);
    try {
      if (on) { await disable(slug, role, sub); setOn(false); } else { await enable(slug, role); setOn(true); }
    } catch (e) { setErr(humanError(e)); }
    setBusy(false);
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <button type="button" role="switch" aria-checked={on} disabled={busy} onClick={toggle}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}>
        <span aria-hidden style={{ width: 34, height: 34, borderRadius: 10, background: on ? 'var(--accent)' : '#8C97A5', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><FingerIcon size={20} color="#fff" /></span>
        <span className="grow stack" style={{ gap: 1 }}>
          <strong>Отпечаток / Face ID</strong>
          <span className="small muted">{hint ?? (on ? 'Включено на этом телефоне' : 'Входить без PIN на этом телефоне')}</span>
        </span>
        <span aria-hidden style={{ width: 46, height: 28, borderRadius: 99, background: on ? 'var(--accent)' : '#d6dbd2', position: 'relative', flex: '0 0 auto', transition: 'background .2s' }}>
          <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .2s' }} />
        </span>
      </button>
      {err && <div className="error" role="alert" style={{ fontSize: 13 }}>{err}</div>}
    </div>
  );
}

/** Кнопка «Войти по отпечатку / Face ID» на экране входа — только если на этом телефоне вход включён */
export function PasskeyLogin({ slug, role, sub, next }: { slug: string; role: Role; sub?: string | null; next: string }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const has = saved(slug, role).some((x) => sub === undefined || x.sub === sub);
    if (has) supported().then(setShow);
  }, [slug, role, sub]);
  if (!show) return null;
  async function go() {
    setBusy(true); setErr(null);
    try { await login(slug, role, sub); window.location.href = next; } catch (e) { setErr(humanError(e)); setBusy(false); }
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <button type="button" className="btn primary block" onClick={go} disabled={busy} style={{ gap: 8 }}>
        <FingerIcon color="#fff" /> {busy ? 'Проверяем…' : 'Войти по отпечатку / Face ID'}
      </button>
      {err && <div className="error" role="alert" style={{ fontSize: 13 }}>{err}</div>}
      <span className="small muted" style={{ textAlign: 'center' }}>или по PIN-коду ниже</span>
    </div>
  );
}
