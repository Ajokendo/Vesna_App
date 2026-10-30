'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

/**
 * Логотип на главной: обычное нажатие ничего не делает, а если подержать палец (~0,6 с) —
 * появляется вход для сотрудников, как при долгом нажатии на значок приложения.
 */
export default function LogoMenu({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = () => { timer.current = setTimeout(() => { navigator.vibrate?.(30); setOpen(true); }, 600); };
  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  return (
    <span style={{ position: 'relative', flex: '0 0 auto' }}>
      <span onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
        style={{ display: 'block', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'manipulation' } as React.CSSProperties}>
        {children}
      </span>
      {open && (
        <>
          <span aria-hidden onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div role="menu" aria-label="Для сотрудников" className="card stack" style={{ position: 'absolute', left: 0, top: 60, zIndex: 61, gap: 8, padding: 10, minWidth: 250, boxShadow: '0 10px 30px rgba(30,40,30,.18)' }}>
            <span className="small muted" style={{ padding: '0 4px' }}>Для сотрудников</span>
            <Link role="menuitem" href={`/${slug}/master`} className="btn" style={{ minHeight: 44, justifyContent: 'flex-start', whiteSpace: 'nowrap', fontSize: 15 }}>✂ Мастера</Link>
            <Link role="menuitem" href={`/${slug}/admin`} className="btn" style={{ minHeight: 44, justifyContent: 'flex-start', whiteSpace: 'nowrap', fontSize: 15 }}>☰ Администратор</Link>
            <Link role="menuitem" href={`/${slug}/owner`} className="btn" style={{ minHeight: 44, justifyContent: 'flex-start', whiteSpace: 'nowrap', fontSize: 15 }}>📊 Директор</Link>
            <Link role="menuitem" href={`/${slug}/help`} className="btn" style={{ minHeight: 44, justifyContent: 'flex-start', whiteSpace: 'nowrap', fontSize: 15 }}>❓ Инструкция</Link>
          </div>
        </>
      )}
    </span>
  );
}
