import Link from 'next/link';

/** Заметная кнопка «На главную» для экранов сотрудников (в приложении на телефоне нет кнопки «назад» браузера) */
export default function BackHome({ slug }: { slug: string }) {
  return (
    <Link href={`/${slug}`} style={{
      alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 14px 0 10px',
      borderRadius: 999, border: '1px solid var(--line)', background: '#fff', color: 'var(--ink)', fontWeight: 800, fontSize: 14, textDecoration: 'none',
    }}>
      <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>←</span> На главную
    </Link>
  );
}
