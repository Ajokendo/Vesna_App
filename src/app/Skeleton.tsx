'use client';

import { usePathname } from 'next/navigation';
import ClientNav from './ClientNav';

/** Мгновенный «скелет» страницы, пока она загружается: нажатие сразу видно, без зависания */
export function SkeletonBlocks({ rows = 4 }: { rows?: number }) {
  return (
    <div className="stack" style={{ gap: 12 }} aria-busy="true" aria-label="Загрузка">
      <div className="sk" style={{ height: 30, width: '55%' }} />
      {Array.from({ length: rows }, (_, i) => <div key={i} className="sk" style={{ height: i === 0 ? 120 : 76 }} />)}
    </div>
  );
}

/** Для страниц клиента: скелет + нижнее меню на своём месте */
export default function ClientSkeleton() {
  const slug = usePathname().split('/')[1] ?? '';
  return (
    <main className="app home">
      <div className="page" style={{ flex: '1 1 auto', minHeight: 0 }}><SkeletonBlocks /></div>
      <ClientNav slug={slug} inline />
    </main>
  );
}
