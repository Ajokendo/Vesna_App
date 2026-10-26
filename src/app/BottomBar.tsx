import Link from 'next/link';

export const ICONS = {
  home: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  list: 'M4 5h16M4 10h16M4 15h10M4 20h7',
  money: 'M3 7h18v12H3zM3 11h18M7 15h3',
  exit: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
};

type Item = { label: string; icon: keyof typeof ICONS; href?: string; action?: () => Promise<void>; current?: boolean };

/** Нижняя панель для экранов сотрудников: всегда на месте, над полоской «домой» телефона */
export default function BottomBar({ items }: { items: Item[] }) {
  const cell = (on?: boolean) => ({
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 60, padding: '6px 2px', width: '100%',
    textDecoration: 'none', color: on ? 'var(--accent-dark)' : 'var(--muted)', fontSize: 11, fontWeight: on ? 800 : 600, lineHeight: 1.1,
    background: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' as const,
  });
  const icon = (k: keyof typeof ICONS, on?: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[k]} />
    </svg>
  );
  return (
    <>
      <div aria-hidden style={{ height: 'calc(76px + env(safe-area-inset-bottom))' }} />
      <nav aria-label="Разделы" style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50, background: 'rgba(255,255,255,.97)', borderTop: '1px solid var(--line)',
        boxShadow: '0 -4px 16px rgba(30,40,30,.06)', paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, ${items.length === 1 ? '120px' : '1fr'}))`, justifyContent: 'center', maxWidth: 560, margin: '0 auto' }}>
          {items.map((it) => it.action ? (
            <form key={it.label} action={it.action} style={{ display: 'flex' }}>
              <button type="submit" style={{ ...cell(it.current), fontSize: 11 }}>{icon(it.icon)}{it.label}</button>
            </form>
          ) : (
            <Link key={it.label} href={it.href!} aria-current={it.current ? 'page' : undefined} style={cell(it.current)}>{icon(it.icon, it.current)}{it.label}</Link>
          ))}
        </div>
      </nav>
    </>
  );
}
