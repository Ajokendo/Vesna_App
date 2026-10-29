'use client';

import { useEffect, useState } from 'react';
import { PasskeyToggle } from '@/app/Passkey';
import { useT } from '@/app/Lang';

/** «Открывать приложение по отпечатку / Face ID» — только в установленном приложении и если телефон узнал клиента */
export default function LockToggle({ slug }: { slug: string }) {
  const t = useT();
  const [app, setApp] = useState(false);
  useEffect(() => {
    setApp(window.matchMedia('(display-mode: standalone)').matches || !!(navigator as unknown as { standalone?: boolean }).standalone);
  }, []);
  if (!app) return null;
  return (
    <section className="card" style={{ padding: '10px 14px' }}>
      <PasskeyToggle slug={slug} role="CLIENT" hint={t('Открывать приложение только по пальцу или лицу')} />
    </section>
  );
}
