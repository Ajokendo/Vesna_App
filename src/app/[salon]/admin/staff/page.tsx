import { notFound, redirect } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { isAdmin } from '@/server/admin-auth';
import { setMasterPin } from '@/server/master-auth';
import { getMastersForLogin } from '@/server/master';

export const dynamic = 'force-dynamic';

/** Администратор выдаёт мастерам PIN-коды для входа в кабинет */
export default async function StaffPins({ params, searchParams }: {
  params: Promise<{ salon: string }>;
  searchParams: Promise<{ ok?: string; e?: string }>;
}) {
  const { salon: slug } = await params;
  const sp = await searchParams;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const masters = await getMastersForLogin(salon.id);

  async function save(formData: FormData) {
    'use server';
    if (!(await isAdmin())) redirect(`/${slug}/admin`);
    const id = String(formData.get('id') ?? '');
    try {
      await setMasterPin(salon!.id, id, String(formData.get('pin') ?? '').trim());
    } catch (e) {
      redirect(`/${slug}/admin/staff?e=${encodeURIComponent((e as Error).message)}`);
    }
    redirect(`/${slug}/admin/staff?ok=${id}`);
  }

  return (
    <main className="safe" style={{ padding: '24px 28px 40px', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <h1 style={{ fontSize: 26 }}>Мастера и PIN-коды</h1>
        <p className="muted" style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
          Каждый мастер входит в свой кабинет по ссылке <strong>{`/${slug}/master`}</strong> со своим PIN-кодом (4–6 цифр).
          В кабинете — его записи и его заработок. Чужие записи и деньги мастер не видит.
          PIN хранится в зашифрованном виде: если мастер забыл его — задайте новый. После 5 неверных попыток вход блокируется на 15 минут.
        </p>
      </header>
      {sp.e && <div className="error" role="alert">{sp.e}</div>}
      <div className="stack">
        {masters.map((m) => (
          <form key={m.id} action={save} className="card row" style={{ flexWrap: 'wrap', gap: 14 }}>
            <input type="hidden" name="id" value={m.id} />
            <span className="avatar" style={{ width: 48, height: 48 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.photoUrl ? <img src={m.photoUrl} alt="" /> : m.name[0]}
            </span>
            <div className="grow" style={{ minWidth: 160 }}>
              <strong>{m.name}</strong>
              <div className="small" style={{ color: sp.ok === m.id ? 'var(--accent-dark)' : m.hasPin || m.isOwner ? 'var(--muted)' : 'var(--danger)', fontWeight: 700 }}>
                {sp.ok === m.id ? '✓ PIN сохранён' : m.locked ? 'Вход временно заблокирован' : m.hasPin ? 'PIN выдан' : m.isOwner ? 'Не обязательно — видит всё в журнале' : 'PIN не выдан'}
              </div>
            </div>
            <input name="pin" aria-label={`Новый PIN для ${m.name}`} placeholder={m.hasPin ? 'Новый PIN' : 'PIN'} inputMode="numeric" pattern="\d{4,6}" required autoComplete="off"
              style={{ minHeight: 48, width: 130, borderRadius: 12, border: '1px solid #dde5de', padding: '0 14px', fontSize: 16 }} />
            <button type="submit" className="btn primary">{m.hasPin ? 'Сменить' : 'Задать'}</button>
          </form>
        ))}
      </div>
    </main>
  );
}
