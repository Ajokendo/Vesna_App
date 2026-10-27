import BottomBar from '@/app/BottomBar';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import AdminNav from './AdminNav';
import AdminLogin, { AdminSetup } from './AdminLogin';
import { completeSetup, isAdmin, needsSetup, signInWithPin } from '@/server/admin-auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ salon: string }> }) {
  const { salon } = await params;
  if (await isAdmin(salon)) {
    return (
      <>
        {children}
        {/* место под нижнюю панель, чтобы она не закрывала конец страницы */}
        <div aria-hidden style={{ height: 'calc(76px + env(safe-area-inset-bottom))' }} />
        <Suspense><AdminNav slug={salon} /></Suspense>
      </>
    );
  }

  async function login(_prev: string | null, formData: FormData): Promise<string | null> {
    'use server';
    const res = await signInWithPin(salon, String(formData.get('pin') ?? ''));
    if (!res.ok) return res.error;
    redirect(`/${salon}/admin`);
  }

  async function setup(_prev: string | null, formData: FormData): Promise<string | null> {
    'use server';
    const pin = String(formData.get('pin') ?? '').trim();
    if (pin !== String(formData.get('pin2') ?? '').trim()) return 'PIN-коды не совпадают';
    const res = await completeSetup(salon, String(formData.get('code') ?? ''), pin);
    if (!res.ok) return res.error;
    redirect(`/${salon}/admin/settings`);
  }

  const firstTime = await needsSetup(salon);
  return (
    <main className="app">
      {firstTime ? <AdminSetup action={setup} /> : <AdminLogin action={login} slug={salon} />}
      <BottomBar items={[{ label: 'Главная', icon: 'home', href: `/${salon}` }]} />
    </main>
  );
}
