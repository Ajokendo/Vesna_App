import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { checkId } from '@/server/push';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Поздравления и акции' };

/** Отписка от поздравлений и акций (сообщения о записях приходят всегда) */
export default async function Unsub({ params, searchParams }: { params: Promise<{ salon: string }>; searchParams: Promise<{ c?: string; t?: string }> }) {
  const { salon } = await params;
  const { c = '', t = '' } = await searchParams;
  if (!c || !(await checkId(`unsub:${c}`, t))) notFound();
  const client = await db.query.clients.findFirst({ where: eq(s.clients.id, c) });
  if (!client) notFound();

  async function set(formData: FormData) {
    'use server';
    await db.update(s.clients).set({ promoOptOut: formData.get('off') === '1' }).where(eq(s.clients.id, c));
    redirect(`/${salon}/unsub?c=${c}&t=${t}`);
  }
  return (
    <main className="app">
      <form action={set} className="page" style={{ justifyContent: 'center' }}>
        <h1 style={{ fontSize: 24 }}>Поздравления и акции</h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
          {client.promoOptOut
            ? 'Вы отписались: поздравления и акции больше не придут. Напоминания о ваших записях будут приходить как раньше.'
            : 'Сейчас вы получаете поздравления и акции салона. Напоминания о ваших записях приходят в любом случае.'}
        </p>
        <input type="hidden" name="off" value={client.promoOptOut ? '0' : '1'} />
        <button type="submit" className={`btn block ${client.promoOptOut ? 'primary' : ''}`}>
          {client.promoOptOut ? 'Снова получать поздравления и акции' : 'Не присылать поздравления и акции'}
        </button>
        <Link href={`/${salon}`} className="small muted" style={{ textAlign: 'center' }}>На главную</Link>
      </form>
    </main>
  );
}
