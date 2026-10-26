'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const ITEMS = [
  { path: 'HOME', label: 'Главная', icon: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10' },
  { path: '', label: 'Журнал', icon: 'M4 5h16M4 10h16M4 15h10M4 20h7' },
  { path: '/cash', label: 'Касса', icon: 'M3 7h18v12H3zM3 11h18M7 15h3' },
  { path: '/notify', label: 'Уведомления', icon: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0' },
  { path: '/settings', label: 'Настройки', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.5-1.5L17 5l-3-1-1 2h-2l-1-2-3 1 .5 1.7L6 8.2 4 8l-1 3 2 1v0l-2 1 1 3 2-.2 1.5 1.5L7 19l3 1 1-2h2l1 2 3-1-.5-1.7 1.5-1.5 2 .2 1-3z' },
];

/** Нижняя панель разделов администратора — всегда на месте, с учётом полоски «домой» на телефоне */
export default function AdminNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const base = `/${slug}/admin`;
  const date = sp.get('date');
  return (
    <nav aria-label="Разделы администратора" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, background: 'rgba(255,255,255,.97)', borderTop: '1px solid var(--line)',
      boxShadow: '0 -4px 16px rgba(30,40,30,.06)', paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ITEMS.length}, 1fr)`, maxWidth: 720, margin: '0 auto' }}>
        {ITEMS.map((it) => {
          const href = it.path === 'HOME' ? `/${slug}` : base + it.path;
          const on = pathname === href;
          const keepDate = date && (it.path === '' || it.path === '/cash');
          return (
            <Link key={it.path} href={keepDate ? `${href}?date=${date}` : href} aria-current={on ? 'page' : undefined} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 60, padding: '6px 2px',
              textDecoration: 'none', color: on ? 'var(--accent-dark)' : 'var(--muted)', fontSize: 11, fontWeight: on ? 800 : 600, lineHeight: 1.1, textAlign: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={it.icon} />
              </svg>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
