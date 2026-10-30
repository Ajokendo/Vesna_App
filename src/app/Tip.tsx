'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Подсказка на месте: значок ⓘ, по нажатию — 1–2 строки пояснения и «Подробнее» (тема инструкции).
 * Закрывается повторным нажатием, нажатием мимо или Esc.
 */
export default function Tip({ text, help, slug, role = 'admin', align = 'left' }: {
  text: React.ReactNode; help?: string; slug?: string; role?: 'admin' | 'master' | 'owner'; align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>(align);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Подсказка" aria-expanded={open} onClick={() => {
        // пузырь — в ту сторону, где есть место (у правого края экрана — влево)
        const r = ref.current?.getBoundingClientRect();
        if (r) setSide(r.left > window.innerWidth / 2 ? 'right' : 'left');
        setOpen(!open);
      }} style={{
        width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--line)', background: open ? 'var(--accent)' : '#fff',
        color: open ? '#fff' : 'var(--accent-dark)', fontSize: 13, fontWeight: 800, lineHeight: 1, cursor: 'pointer', padding: 0,
        display: 'inline-grid', placeItems: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic',
      }}>i</button>
      {open && (
        <span role="tooltip" style={{
          position: 'absolute', top: 28, [side]: -6, zIndex: 90, width: 'min(280px, 80vw)', background: '#26332a', color: '#fff',
          borderRadius: 12, padding: '10px 12px', fontSize: 13, fontWeight: 500, lineHeight: 1.4, textAlign: 'left',
          boxShadow: '0 10px 30px rgba(0,0,0,.25)', whiteSpace: 'normal', letterSpacing: 0, textTransform: 'none',
        } as React.CSSProperties}>
          {text}
          {help && slug && (
            <a href={`/${slug}/help/${help}?r=${role}`} style={{ display: 'block', marginTop: 6, color: '#cfe6c4', fontWeight: 700 }}>Подробнее в инструкции ›</a>
          )}
        </span>
      )}
    </span>
  );
}
