import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/server/admin-auth';
import { closeWaitlist } from '@/server/waitlist';

type Item = { id: string; client: string; clientId: string; phone: string | null; title: string; notified: boolean };

/** Лист ожидания на день — над журналом: кто ждёт, что освободится время; написать или убрать */
export default function WaitList({ slug, items, dateLabel, salonName }: { slug: string; items: Item[]; dateLabel: string; salonName: string }) {
  if (!items.length) return null;
  async function remove(fd: FormData) {
    'use server';
    if (!(await isAdmin(slug))) return;
    await closeWaitlist(slug, String(fd.get('id')), 'ADMIN').catch(() => {});
    revalidatePath(`/${slug}/admin`);
  }
  return (
    <details className="card" style={{ borderColor: 'var(--gold)', background: '#fffdf6' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 800 }}>⏳ Лист ожидания на этот день: {items.length}</summary>
      <p className="small muted" style={{ margin: '6px 0 8px', lineHeight: 1.45 }}>
        Эти клиенты ждут, что освободится время. Когда запись отменяют, приложение само сообщает им (если у них включены уведомления). Можно и написать самим.
      </p>
      <div className="stack" style={{ gap: 0 }}>
        {items.map((w) => {
          const phone = w.phone?.replace(/\D/g, '') ?? '';
          const text = `Здравствуйте, ${w.client}! Это салон «${salonName}». Освободилось время ${dateLabel} — записать вас?`;
          return (
            <form key={w.id} action={remove} className="row" style={{ gap: 8, borderTop: '1px solid var(--line)', padding: '8px 0', flexWrap: 'wrap' }}>
              <input type="hidden" name="id" value={w.id} />
              <span className="grow" style={{ minWidth: 160 }}>
                <Link href={`/${slug}/admin/clients/${w.clientId}`} style={{ fontWeight: 700, color: 'var(--ink)' }}>{w.client}</Link>
                <span className="small muted" style={{ display: 'block' }}>{w.title}{w.notified ? ' · уведомление отправлено' : ''}</span>
              </span>
              {phone && <a className="btn" style={{ minHeight: 38, fontSize: 13, padding: '0 10px' }} target="_blank" rel="noreferrer" href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}>WhatsApp</a>}
              {phone && <a className="btn" style={{ minHeight: 38, fontSize: 13, padding: '0 10px' }} href={`tel:+${phone}`}>Позвонить</a>}
              <button type="submit" className="btn" style={{ minHeight: 38, fontSize: 13, padding: '0 10px', color: 'var(--muted)' }}>Убрать</button>
            </form>
          );
        })}
      </div>
    </details>
  );
}
