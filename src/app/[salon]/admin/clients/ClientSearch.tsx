'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/** Поле поиска: результаты обновляются по мере ввода */
export default function ClientSearch({ q }: { q: string }) {
  const router = useRouter();
  const path = usePathname();
  const [v, setV] = useState(q);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => router.replace(v.trim() ? `${path}?q=${encodeURIComponent(v.trim())}` : path), 300);
    return () => clearTimeout(t);
  }, [v, path, router]);
  return (
    <input type="search" value={v} onChange={(e) => setV(e.target.value)} autoFocus={!q} enterKeyHint="search"
      placeholder="Телефон (любые цифры) или имя" aria-label="Поиск клиента"
      style={{ minHeight: 50, borderRadius: 14, border: '1px solid #cfd9cf', padding: '0 16px', fontSize: 17, width: '100%', background: '#fff' }} />
  );
}
