import { redirect } from 'next/navigation';
import { setOwnerPin, signOutOwner } from '@/server/owner-auth';
import PinChange from './PinChange';

/** Внизу кабинета хозяйки: сменить PIN хозяйки и выйти (например, если открывала на чужом телефоне) */
export default function OwnerAccount({ slug }: { slug: string }) {
  async function change(_prev: string | null, fd: FormData): Promise<string | null> {
    'use server';
    const pin = String(fd.get('pin') ?? '').trim();
    if (pin !== String(fd.get('pin2') ?? '').trim()) return 'PIN-коды не совпадают';
    const res = await setOwnerPin(slug, pin);
    return res.ok ? 'ok' : res.error;
  }
  async function out() {
    'use server';
    await signOutOwner(slug);
    redirect(`/${slug}`);
  }
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>PIN хозяйки и выход</summary>
      <div className="stack" style={{ gap: 12, marginTop: 10 }}>
        <PinChange action={change} />
        <form action={out}><button type="submit" className="btn" style={{ minHeight: 42 }}>Выйти из кабинета хозяйки</button></form>
      </div>
    </details>
  );
}
