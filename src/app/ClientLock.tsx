'use client';

import { useEffect, useState } from 'react';
import { disable, humanError, login } from './passkey-client';
import { FingerIcon } from './Passkey';

/**
 * Замок приложения клиента: если клиент включил «Отпечаток / Face ID», при каждом запуске приложение
 * закрыто экраном с логотипом, пока телефон не подтвердит палец или лицо. Включается и выключается в «Ещё».
 * Экран включает скрипт в layout ещё до отрисовки страницы (класс locked), этот компонент — снимает.
 */
export default function ClientLock({ slug, logo, name }: { slug: string; logo: string; name: string }) {
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const unlock = async (auto = false) => {
    setBusy(true); setErr(null);
    try {
      await login(slug, 'CLIENT');
      try { sessionStorage.setItem(`unlocked:${slug}`, '1'); } catch { /* */ }
      document.documentElement.classList.remove('locked');
      setLocked(false);
    } catch (e) { if (!auto) setErr(humanError(e)); }
    setBusy(false);
  };
  useEffect(() => {
    if (!document.documentElement.classList.contains('locked')) return;
    setLocked(true);
    // после заставки сразу спросить палец / лицо (на iPhone может понадобиться нажать кнопку)
    const t = setTimeout(() => unlock(true), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function forget() {
    await disable(slug, 'CLIENT').catch(() => {});
    try { localStorage.removeItem(`pk:${slug}:CLIENT`); } catch { /* */ }
    await fetch(`/api/${slug}/me`, { method: 'DELETE' }).catch(() => {});
    window.location.href = `/${slug}`;
  }
  return (
    <div id="lock" aria-hidden={!locked} role={locked ? 'dialog' : undefined} aria-label="Приложение заблокировано">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt="" />
      <strong style={{ fontSize: 18 }}>Салон «{name}»</strong>
      <button type="button" className="btn primary" onClick={() => unlock()} disabled={busy} style={{ gap: 8, minWidth: 240 }}>
        <FingerIcon color="#fff" /> {busy ? 'Проверяем…' : 'Открыть по отпечатку / Face ID'}
      </button>
      {err && <div className="error" role="alert" style={{ fontSize: 13, maxWidth: 300 }}>{err}</div>}
      <button type="button" className="small" onClick={forget} style={{ border: 0, background: 'none', color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer', marginTop: 8 }}>
        Не получается? Выйти на этом телефоне
      </button>
    </div>
  );
}
