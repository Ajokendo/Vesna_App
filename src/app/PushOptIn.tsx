'use client';

import { useEffect, useState } from 'react';

type State = 'checking' | 'unsupported' | 'ios-install' | 'off' | 'on' | 'denied' | 'busy' | 'error';

function urlBase64ToUint8Array(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Кнопка «Получать напоминания»: подписывает телефон на push по записи клиента */
export default function PushOptIn({ slug, appointmentId, token, compact }: { slug: string; appointmentId: string; token: string; compact?: boolean }) {
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState(ios && !standalone ? 'ios-install' : 'unsupported'); return;
      }
      if (Notification.permission === 'denied') { setState('denied'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === 'granted') {
        // телефон уже подписан — привязываем к этой записи (для повторных визитов)
        await save(sub).catch(() => {});
        setState('on');
      } else setState('off');
    })().catch(() => setState('unsupported'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(sub: PushSubscription) {
    const res = await fetch(`/api/${slug}/push/subscribe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId, token, subscription: sub.toJSON() }),
    });
    if (!res.ok) throw new Error('save');
  }

  async function enable() {
    setState('busy');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'off'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const { publicKey } = await (await fetch('/api/push/key')).json();
      const sub = (await reg.pushManager.getSubscription())
        ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      await save(sub);
      setState('on');
    } catch { setState('error'); }
  }

  const box = { width: '100%', textAlign: 'left' as const, background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: compact ? 12 : 14 };
  if (state === 'checking') return null;
  if (state === 'on') return <div className="note" style={{ width: '100%', textAlign: 'left' }}>🔔 Напоминания включены: утром в день визита и за час до начала.</div>;
  if (state === 'ios-install') return (
    <div style={box} className="small">
      <strong>Хотите напоминания о записи?</strong>
      <div className="muted" style={{ marginTop: 4, lineHeight: 1.45 }}>На iPhone: нажмите «Поделиться» внизу Safari → «На экран Домой», откройте приложение салона с экрана и нажмите «Получать напоминания».</div>
    </div>
  );
  if (state === 'unsupported') return null;
  if (state === 'denied') return <div style={box} className="small muted">Уведомления запрещены в настройках браузера. Разрешите их для этого сайта, чтобы получать напоминания.</div>;
  return (
    <div style={box} className="stack">
      <div className="small"><strong>Напомнить о записи?</strong><div className="muted" style={{ marginTop: 2 }}>Утром в день визита (с кнопкой «Подтвердить») и за час до начала.</div></div>
      <button type="button" className="btn primary block" onClick={enable} disabled={state === 'busy'}>{state === 'busy' ? 'Включаем…' : '🔔 Получать напоминания'}</button>
      {state === 'error' && <span className="small" style={{ color: 'var(--danger)' }}>Не получилось — попробуйте ещё раз.</span>}
    </div>
  );
}
