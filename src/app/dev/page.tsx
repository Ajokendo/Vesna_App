import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db, schema as s } from '@/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Сообщения разработчикам', robots: { index: false } };

// Страница разработчика: все сообщения из приложений всех салонов. Пароль — переменная DEV_PASSWORD в настройках сервера.
const token = (pw: string) => createHash('sha256').update(`dev:${pw}`).digest('hex');
const ROLE: Record<string, string> = { CLIENT: 'Клиент', MASTER: 'Мастер', ADMIN: 'Администратор' };

export default async function Dev({ searchParams }: { searchParams: Promise<{ all?: string; e?: string }> }) {
  const pw = process.env.DEV_PASSWORD;
  const sp = await searchParams;
  if (!pw) return <main className="app"><div className="page"><h1 style={{ fontSize: 22 }}>Страница выключена</h1><p className="muted">Задайте DEV_PASSWORD в настройках сервера.</p></div></main>;
  const jar = await cookies();
  const authed = jar.get('dev_auth')?.value === token(pw);

  async function login(fd: FormData) {
    'use server';
    const ok = String(fd.get('pw') ?? '') === process.env.DEV_PASSWORD;
    if (ok) (await cookies()).set('dev_auth', token(process.env.DEV_PASSWORD!), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/dev', maxAge: 60 * 60 * 24 * 60 });
    redirect(ok ? '/dev' : '/dev?e=1');
  }
  async function toggle(fd: FormData) {
    'use server';
    if ((await cookies()).get('dev_auth')?.value !== token(process.env.DEV_PASSWORD ?? '')) redirect('/dev');
    const id = String(fd.get('id')); const resolved = fd.get('resolved') === '1';
    await db.update(s.feedback).set({ resolved }).where(eq(s.feedback.id, id));
    redirect('/dev');
  }

  if (!authed) {
    return (
      <main className="app"><form action={login} className="page" style={{ justifyContent: 'center', maxWidth: 360, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: 22 }}>Для разработчиков</h1>
        <label className="field">Пароль<input name="pw" type="password" required autoFocus /></label>
        {sp.e && <div className="error">Неверный пароль</div>}
        <button className="btn primary block" type="submit">Войти</button>
      </form></main>
    );
  }
  const rows = await db.select().from(s.feedback).orderBy(desc(s.feedback.createdAt)).limit(300);
  const list = sp.all ? rows : rows.filter((r) => !r.resolved);
  return (
    <main style={{ padding: '24px 16px 40px', maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ fontSize: 24 }}>Сообщения разработчикам</h1>
      <span className="small muted">Новых: {rows.filter((r) => !r.resolved).length} · всего: {rows.length} · <a href={sp.all ? '/dev' : '/dev?all=1'}>{sp.all ? 'только новые' : 'показать все'}</a></span>
      {!list.length && <p className="muted">Новых сообщений нет.</p>}
      {list.map((r) => (
        <article key={r.id} className="card stack" style={{ gap: 6, opacity: r.resolved ? 0.6 : 1 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <strong>{ROLE[r.role] ?? r.role} · {r.salonSlug ?? '—'}</strong>
            <span className="small muted">{r.createdAt.toLocaleString('ru-RU', { timeZone: 'Asia/Bishkek' })}</span>
          </div>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{r.text}</p>
          {r.contact && <span className="small">Ответить: <b>{r.contact}</b></span>}
          {(r.page || r.device) && <span className="small muted" style={{ wordBreak: 'break-word' }}>{r.page}{r.device ? ` · ${r.device}` : ''}</span>}
          <form action={toggle}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="resolved" value={r.resolved ? '0' : '1'} />
            <button className="btn" style={{ minHeight: 38, fontSize: 13 }} type="submit">{r.resolved ? 'Вернуть в новые' : '✓ Решено'}</button></form>
        </article>
      ))}
    </main>
  );
}
