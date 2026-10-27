'use client';

import { useEffect, useState } from 'react';
import { PasskeyToggle } from '@/app/Passkey';

/** «Открывать приложение по отпечатку / Face ID» — только в установленном приложении и если телефон узнал клиента */
export default function LockToggle({ slug }: { slug: string }) {
  const [app, setApp] = useState(false);
  useEffect(() => {
    setApp(window.matchMedia('(display-mode: standalone)').matches || !!(navigator as unknown as { standalone?: boolean }).standalone);
  }, []);
  if (!app) return null;
  return (
    <section className="card" style={{ padding: '10px 14px' }}>
      <PasskeyToggle slug={slug} role="CLIENT" hint="Открывать приложение только по пальцу или лицу" />
    </section>
  );
}
