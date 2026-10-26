import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/server/admin-auth';
import { listReviews, rewardGisReview, MIN_RATINGS } from '@/server/reviews';
import { dayMonthShort, utcToZoned } from '@/lib/time';

/** Вкладка «Оценки»: все оценки визитов. Низкие (1–3) — только для салона; 2ГИС — начислить баллы после проверки */
export default async function ReviewsList({ slug }: { slug: string }) {
  const { salon, rows } = await listReviews(slug);
  async function reward(fd: FormData) {
    'use server';
    if (!(await isAdmin(slug))) return;
    await rewardGisReview(slug, String(fd.get('id'))).catch(() => {});
    revalidatePath(`/${slug}/admin/settings`);
  }
  const low = rows.filter((r) => r.stars <= 3).length;
  const gisWaiting = rows.filter((r) => r.stars === 5 && r.gisClickedAt && !r.gisRewardedAt).length;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
        После оплаченного визита клиент получает просьбу оценить мастера (1–5 звёзд). Оценки 1–3 видит только салон — позвоните клиенту и исправьте ситуацию.
        Рейтинг мастера клиенты увидят, только если вы включите его в «Мастера» и наберётся {MIN_RATINGS} оценок.
        {salon.reviewBonus > 0 ? ` После 5 звёзд клиенту предлагается отзыв в 2ГИС: проверьте отзыв на карте и нажмите «Начислить ${salon.reviewBonus} баллов».` : ''}
      </p>
      <div className="row small" style={{ gap: 14, flexWrap: 'wrap' }}>
        <span>Всего оценок: <b>{rows.length}</b></span>
        {low > 0 && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Низких: {low}</span>}
        {gisWaiting > 0 && <span style={{ color: '#B7860F', fontWeight: 700 }}>Ждут проверки 2ГИС: {gisWaiting}</span>}
      </div>
      {!rows.length && <p className="muted" style={{ margin: 0 }}>Оценок пока нет — они появятся после оплаченных визитов.</p>}
      {rows.map((r) => (
        <div key={r.id} className="card stack" style={{ gap: 4, padding: '10px 14px', borderColor: r.stars <= 3 ? '#e5c9cf' : undefined, background: r.stars <= 3 ? '#fdf6f7' : undefined }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
            <span style={{ color: '#E3A21A', fontSize: 18, letterSpacing: 1 }} aria-label={`${r.stars} из 5`}>{'★'.repeat(r.stars)}<span style={{ color: '#d9dcd4' }}>{'★'.repeat(5 - r.stars)}</span></span>
            <span className="small muted">{dayMonthShort(utcToZoned(r.createdAt, salon.timezone).date)}</span>
          </div>
          <span className="small"><b>{r.staff.name}</b> · {r.appointment.service.name} · <Link href={`/${slug}/admin/clients/${r.clientId}`}>{r.client.name}</Link></span>
          {r.text && <span style={{ lineHeight: 1.45 }}>«{r.text}»</span>}
          {r.stars === 5 && r.gisClickedAt && salon.reviewBonus > 0 && (
            r.gisRewardedAt ? <span className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>✓ За отзыв в 2ГИС начислено {salon.reviewBonus} баллов</span> : (
              <form action={reward} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <input type="hidden" name="id" value={r.id} />
                <span className="small muted">Перешёл(ла) оставить отзыв в 2ГИС.</span>
                <button type="submit" className="btn" style={{ minHeight: 36, fontSize: 13 }}>Отзыв есть — начислить {salon.reviewBonus} баллов</button>
              </form>
            )
          )}
        </div>
      ))}
    </div>
  );
}
