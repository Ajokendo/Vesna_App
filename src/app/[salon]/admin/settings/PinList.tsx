import { redirect } from 'next/navigation';
import { isAdmin } from '@/server/admin-auth';
import { setMasterPin } from '@/server/master-auth';
import { getMastersForLogin } from '@/server/master';

/** Вкладка настроек «PIN-коды»: администратор выдаёт мастерам PIN для входа в кабинет */
export default async function PinList({ slug, salonId, sp }: { slug: string; salonId: string; sp: { ok?: string; e?: string } }) {
  const masters = await getMastersForLogin(salonId);
  const back = `/${slug}/admin/settings?tab=pins`;

  async function save(formData: FormData) {
    'use server';
    if (!(await isAdmin())) redirect(`/${slug}/admin`);
    const id = String(formData.get('id') ?? '');
    try {
      await setMasterPin(salonId, id, String(formData.get('pin') ?? '').trim());
    } catch (e) {
      redirect(`${back}&e=${encodeURIComponent((e as Error).message)}`);
    }
    redirect(`${back}&ok=${id}`);
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
        <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Каждый мастер входит в свой кабинет по ссылке <strong>{`/${slug}/master`}</strong> со своим PIN-кодом (4–6 цифр).
          В кабинете — его записи и его заработок. Чужие записи и деньги мастер не видит.
          PIN хранится в зашифрованном виде: если мастер забыл его — задайте новый. После 5 неверных попыток вход блокируется на 15 минут.
        </p>
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
    </div>
  );
}
