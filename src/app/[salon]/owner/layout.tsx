import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import BottomBar from '@/app/BottomBar';
import { isAdmin } from '@/server/admin-auth';
import { isOwner, ownerPinMissing, setOwnerPin, signInOwner } from '@/server/owner-auth';
import OwnerNav from './OwnerNav';
import { OwnerLogin, OwnerSetup } from './OwnerLogin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Кабинет директора' };

/** Кабинет директора: вход по отдельному PIN директора (PIN администратора сюда не пускает) */
export default async function OwnerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ salon: string }> }) {
  const { salon } = await params;
  if (await isOwner(salon)) {
    return (
      <>
        {children}
        <div aria-hidden style={{ height: 'calc(76px + env(safe-area-inset-bottom))' }} />
        <Suspense><OwnerNav slug={salon} /></Suspense>
      </>
    );
  }

  async function login(_prev: string | null, fd: FormData): Promise<string | null> {
    'use server';
    const res = await signInOwner(salon, String(fd.get('pin') ?? ''));
    if (!res.ok) return res.error;
    redirect(`/${salon}/owner`);
  }
  async function setup(_prev: string | null, fd: FormData): Promise<string | null> {
    'use server';
    const pin = String(fd.get('pin') ?? '').trim();
    if (pin !== String(fd.get('pin2') ?? '').trim()) return 'PIN-коды не совпадают';
    const res = await setOwnerPin(salon, pin);
    if (!res.ok) return res.error;
    redirect(`/${salon}/owner`);
  }

  const missing = await ownerPinMissing(salon);
  const admin = missing && await isAdmin(salon);
  return (
    <main className="app">
      {!missing ? <OwnerLogin action={login} slug={salon} /> : admin ? <OwnerSetup action={setup} /> : (
        <div className="page" style={{ justifyContent: 'center', maxWidth: 380, margin: '0 auto', width: '100%' }}>
          <h1 style={{ fontSize: 24 }}>Кабинет директора</h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>PIN директора ещё не задан. Чтобы задать его, сначала войдите как администратор, затем откройте «Настройки» → «Кабинет директора».</p>
          <Link href={`/${salon}/admin`} className="btn primary block">Войти как администратор</Link>
        </div>
      )}
      <BottomBar items={[{ label: 'Главная', icon: 'home', href: `/${salon}` }]} />
    </main>
  );
}
