import { redirect } from 'next/navigation';
import { setOwnerPin, signOutOwner } from '@/server/owner-auth';
import PinChange from './PinChange';
import { PasskeyToggle } from '@/app/Passkey';
import Link from 'next/link';

/** Внизу кабинета директора: сменить PIN директора и выйти (например, если открывали на чужом телефоне) */
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
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Вход: отпечаток / Face ID, PIN, выход</summary>
      <div className="stack" style={{ gap: 12, marginTop: 10 }}>
        <PasskeyToggle slug={slug} role="OWNER" />
        <PinChange action={change} />
        <Link href={`/${slug}/help?r=owner`} className="btn" style={{ minHeight: 42 }}>❓ Инструкция</Link>
        <form action={out}><button type="submit" className="btn" style={{ minHeight: 42 }}>Выйти из кабинета директора</button></form>
      </div>
    </details>
  );
}
