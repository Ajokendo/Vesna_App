import type { ReactNode } from 'react';

/** Подсказка не сплошным текстом, а короткими строками: значок + одна мысль на строку */
export default function Hints({ items, style }: { items: [icon: string, text: ReactNode][]; style?: React.CSSProperties }) {
  return (
    <ul className="small" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 5, color: 'var(--muted)', lineHeight: 1.4, ...style }}>
      {items.filter(([, t]) => t !== null && t !== false && t !== '').map(([icon, text], i) => (
        <li key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 6, alignItems: 'start' }}>
          <span aria-hidden style={{ textAlign: 'center' }}>{icon}</span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}
