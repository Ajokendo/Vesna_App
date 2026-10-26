'use client';

import { useEffect, useState } from 'react';

/**
 * «Подключить клиента к приложению»: QR со ссылкой на его запись. Клиент наводит камеру —
 * открывается его запись, телефон запоминает клиента, дальше — установка приложения и подарочные баллы.
 */
export default function ConnectClient({ slug, id, token, bonus }: { slug: string; id: string; token: string; bonus: number }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || svg) return;
    import('qrcode').then((QR) => QR.toString(`${location.origin}/${slug}/v/${id}?t=${token}`, { type: 'svg', margin: 1, color: { dark: '#24331f', light: '#ffffff' } }))
      .then(setSvg).catch(() => setSvg(''));
  }, [open, svg, slug, id, token]);
  if (!token) return null;
  if (!open) {
    return (
      <button type="button" className="small" onClick={() => setOpen(true)}
        style={{ alignSelf: 'flex-start', border: '1px solid var(--gold)', background: '#fbf6ea', borderRadius: 10, padding: '6px 10px', fontWeight: 800, cursor: 'pointer', color: 'var(--ink)' }}>
        📲 Подключить клиента к приложению
      </button>
    );
  }
  return (
    <div className="stack" style={{ gap: 8, alignItems: 'center', textAlign: 'center', background: '#fbf6ea', border: '1px solid var(--gold)', borderRadius: 14, padding: 12 }}>
      {svg ? <div style={{ width: 200 }} dangerouslySetInnerHTML={{ __html: svg }} /> : <span className="small muted">Готовим QR…</span>}
      <span className="small" style={{ lineHeight: 1.45 }}>
        Пусть клиент наведёт камеру своего телефона на код: откроется его запись, затем — «Установить приложение».
        {bonus > 0 ? <> После установки ему сразу начислится <b>{bonus} баллов</b>.</> : null}
      </span>
      <button type="button" className="small" onClick={() => setOpen(false)} style={{ border: 0, background: 'none', color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer' }}>Скрыть</button>
    </div>
  );
}
