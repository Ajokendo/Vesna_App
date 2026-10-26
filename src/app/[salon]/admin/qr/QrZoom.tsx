'use client';

import { useState } from 'react';

/** QR на табличке: нажатие — на весь экран (удобно показать клиенту с телефона) */
export default function QrZoom({ svg, className, style }: { svg: string; className?: string; style?: React.CSSProperties }) {
  const [big, setBig] = useState(false);
  return (
    <>
      <button type="button" aria-label="Увеличить QR-код" onClick={() => setBig(true)} className={className}
        style={{ ...style, border: 0, padding: 0, background: 'none', cursor: 'zoom-in' }} dangerouslySetInnerHTML={{ __html: svg }} />
      {big && (
        <div role="dialog" aria-modal="true" aria-label="QR-код" onClick={() => setBig(false)} className="no-print" style={{
          position: 'fixed', inset: 0, zIndex: 90, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20,
        }}>
          <div style={{ width: 'min(92vw, 80dvh)', aspectRatio: '1' }} className="p-qr" dangerouslySetInnerHTML={{ __html: svg }} />
          <span className="muted" style={{ fontWeight: 700 }}>Нажмите, чтобы закрыть</span>
        </div>
      )}
    </>
  );
}
