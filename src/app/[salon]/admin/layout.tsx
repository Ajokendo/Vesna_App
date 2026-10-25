import { redirect } from 'next/navigation';
import { isAdmin, signInWithPin } from '@/server/admin-auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ salon: string }> }) {
  const { salon } = await params;
  if (await isAdmin()) return <>{children}</>;

  async function login(formData: FormData) {
    'use server';
    const ok = await signInWithPin(String(formData.get('pin') ?? ''));
    redirect(`/${salon}/admin${ok ? '' : '?wrong=1'}`);
  }

  return (
    <main className="app">
      <form action={login} className="page" style={{ justifyContent: 'center', maxWidth: 360, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: 24 }}>Вход для сотрудников</h1>
        <label className="field">PIN-код<input name="pin" type="password" inputMode="numeric" autoComplete="current-password" required /></label>
        <button type="submit" className="btn primary block">Войти</button>
        {!process.env.ADMIN_PIN && <div className="note">PIN не задан: укажите ADMIN_PIN в настройках сервера.</div>}
      </form>
    </main>
  );
}
