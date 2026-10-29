'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import AppBonus from './AppBonus';
import { useT } from './Lang';

const ITEMS = [
  { path: '', label: 'Главная', icon: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10' },
  { path: '/book', label: 'Записаться', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M12 13v5M9.5 15.5h5' },
  { path: '/my', label: 'Мои записи', icon: 'M10 6h10M10 12h10M10 18h10M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17' },
  { path: '/points', label: 'Баллы', icon: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.3l6-.7z' },
  { path: '/more', label: 'Ещё', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
];

/**
 * Нижнее меню клиента. inline — для главной (экран фиксированной высоты, меню — последний блок),
 * иначе закреплено внизу экрана поверх содержимого.
 */
export default function ClientNav({ slug, inline }: { slug: string; inline?: boolean }) {
  const pathname = usePathname();
  const t = useT();
  const base = `/${slug}`;
  const nav = (
    <nav aria-label={t('Меню')} style={{
      ...(inline ? { flex: '0 0 auto' } : { position: 'fixed' as const, left: 0, right: 0, bottom: 0, zIndex: 50 }),
      background: 'rgba(255,255,255,.97)', borderTop: '1px solid var(--line)', boxShadow: '0 -4px 16px rgba(30,40,30,.06)',
      paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ITEMS.length}, 1fr)`, maxWidth: 560, margin: '0 auto' }}>
        {ITEMS.map((it) => {
          const href = base + it.path;
          const on = it.path ? pathname.startsWith(href) : pathname === href;
          return (
            <Link key={it.path} href={href} aria-current={on ? 'page' : undefined} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 60, padding: '6px 2px',
              textDecoration: 'none', color: on ? 'var(--accent-dark)' : 'var(--muted)', fontSize: 11, fontWeight: on ? 800 : 600, lineHeight: 1.1, textAlign: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={it.icon} />
              </svg>
              {t(it.label)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
  const bonus = <Suspense><AppBonus slug={slug} /></Suspense>;
  if (inline) return <>{bonus}{nav}</>;
  return (<>{bonus}<div aria-hidden style={{ height: 'calc(72px + env(safe-area-inset-bottom))' }} />{nav}</>);
}
