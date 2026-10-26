'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || !!(navigator as unknown as { standalone?: boolean }).standalone);

/** Обновить манифест, чтобы установленное приложение запомнило клиента (после записи или открытия ссылки) */
export function refreshManifest() {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (link) link.href = `/api/manifest?s=${location.pathname.split('/')[1] || 'vesna'}&v=${Date.now()}`;
}

/**
 * Работает на всех клиентских страницах:
 * 1) установленное приложение открылось с ключом клиента (?me=…) — запоминаем клиента внутри приложения;
 * 2) приложение открыто как установленное — один раз дарим баллы и показываем поздравление.
 */
export default function AppBonus({ slug }: { slug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [gift, setGift] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const me = sp.get('me');
      if (me) {
        await fetch(`/api/${slug}/me`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ me }) }).catch(() => {});
        router.replace(pathname);
        router.refresh();
      }
      if (!isStandalone()) return;
      const r = await fetch(`/api/${slug}/me/welcome`, { method: 'POST' }).then((x) => x.json()).catch(() => null);
      if (alive && r?.granted > 0) { setGift(r.granted); router.refresh(); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!gift) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Подарок" onClick={() => setGift(null)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(23,35,28,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card stack" style={{ maxWidth: 360, textAlign: 'center', gap: 10, borderColor: 'var(--gold)', padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 48, lineHeight: 1 }} aria-hidden>🎁</div>
        <strong style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>Спасибо, что с нами!</strong>
        <span>Дарим вам <b style={{ color: 'var(--accent-dark)' }}>{gift} баллов</b> за установку приложения.</span>
        <span className="small muted">1 балл = 1 сом. Копите дальше — с каждого визита начисляются новые баллы, а оплатить ими можно всю услугу или её часть.</span>
        <button type="button" className="btn primary" onClick={() => { setGift(null); router.push(`/${slug}/points`); }}>Мои баллы</button>
      </div>
    </div>
  );
}
