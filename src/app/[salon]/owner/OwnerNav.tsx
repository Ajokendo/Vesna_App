'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const ITEMS = [
  { path: '', label: 'Выручка', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { path: '/pay', label: 'Зарплата', icon: 'M3 7h18v12H3zM3 11h18M7 15h3' },
  { path: '/stats', label: 'Мастера', icon: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a5.5 5.5 0 0 1 3.5 6' },
  { path: '/costs', label: 'Расходы', icon: 'M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.8 5 3.4 5 1.6 5 3.6-2.2 3-5 3-5-1.1-5-3' },
  { path: 'ADMIN', label: 'Журнал', icon: 'M4 5h16M4 10h16M4 15h10M4 20h7' },
];

/** Нижняя панель кабинета хозяйки; выбранный период сохраняется при переходе между разделами */
export default function OwnerNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const base = `/${slug}/owner`;
  const q = sp.get('p') ? `?p=${sp.get('p')}${sp.get('at') ? `&at=${sp.get('at')}` : ''}` : '';
  return (
    <nav aria-label="Разделы кабинета хозяйки" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, background: 'rgba(255,255,255,.97)', borderTop: '1px solid var(--line)',
      boxShadow: '0 -4px 16px rgba(30,40,30,.06)', paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ITEMS.length}, 1fr)`, maxWidth: 720, margin: '0 auto' }}>
        {ITEMS.map((it) => {
          const href = it.path === 'ADMIN' ? `/${slug}/admin` : base + it.path + q;
          const on = it.path !== 'ADMIN' && pathname === base + it.path;
          return (
            <Link key={it.path} href={href} aria-current={on ? 'page' : undefined} style={{
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
