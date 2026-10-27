import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { pushStats, recentBroadcasts } from '@/server/broadcast';
import { getMastersForLogin } from '@/server/master';
import { utcToZoned } from '@/lib/time';
import BroadcastForm from './BroadcastForm';
import { plural } from '@/lib/pricing';
import Hints from '@/app/Hints';

export const dynamic = 'force-dynamic';

export default async function NotifyPage({ params }: { params: Promise<{ salon: string }> }) {
  const { salon: slug } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const [stats, history, masters] = await Promise.all([pushStats(salon.id), recentBroadcasts(salon.id), getMastersForLogin(salon.id)]);
  const today = utcToZoned(new Date(), salon.timezone).date;
  return (
    <main className="safe" style={{ padding: '24px 28px 40px', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <h1 style={{ fontSize: 26 }}>Уведомления</h1>
        <Hints style={{ marginTop: 8 }} items={[
          ['👥', <>Уведомления {plural(stats.clients, 'включил', 'включили', 'включили')} <strong style={{ color: 'var(--ink)' }}>{stats.clients}</strong> {plural(stats.clients, 'клиент', 'клиента', 'клиентов')}</>],
          ['⏰', 'Напоминания о записях уходят сами: при записи, утром в день визита и за час'],
          ['📣', 'Здесь — рассылки от салона: важное о работе, поздравления и акции'],
        ]} />
      </header>
      <BroadcastForm slug={slug} salonName={salon.name} today={today} masters={masters.map((m) => ({ id: m.id, name: m.name }))} />
      <section className="card stack" style={{ gap: 0 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Отправленные</h2>
        {history.length === 0 ? <p className="muted" style={{ margin: 0 }}>Рассылок пока не было.</p> : history.map((b) => (
          <div key={b.id} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{b.title}</strong>
              <span className="small muted">{b.createdAt.toLocaleString('ru-RU', { timeZone: salon.timezone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="small" style={{ marginTop: 2 }}>{b.body}</div>
            <div className="small muted" style={{ marginTop: 2 }}>{b.kind === 'PROMO' ? 'Поздравление/акция' : 'Важное'} · {b.audience} · доставлено на {b.delivered} тел. · {b.recipients} {plural(b.recipients, 'клиент', 'клиента', 'клиентов')}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
