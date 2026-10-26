import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { searchClients } from '@/server/clients';
import { dayMonthShort } from '@/lib/time';
import ClientSearch from './ClientSearch';
import QrScanner from './QrScanner';

export const dynamic = 'force-dynamic';

/** База клиентов: поиск по телефону или имени */
export default async function Clients({ params, searchParams }: { params: Promise<{ salon: string }>; searchParams: Promise<{ q?: string }> }) {
  const { salon: slug } = await params;
  const { q = '' } = await searchParams;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const rows = await searchClients(slug, q);
  return (
    <main className="safe" style={{ padding: '24px 28px 40px', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h1 style={{ fontSize: 26 }}>Клиенты</h1>
      <ClientSearch q={q} />
      <QrScanner slug={slug} />
      <span className="small muted">{q ? `Найдено: ${rows.length}${rows.length === 40 ? '+' : ''}` : 'Недавние клиенты — начните вводить номер или имя'}</span>
      <div className="stack" style={{ gap: 8 }}>
        {rows.map((c) => (
          <Link key={c.id} href={`/${slug}/admin/clients/${c.id}`} className="card row" style={{ gap: 12, padding: '12px 14px', textDecoration: 'none', color: 'inherit' }}>
            <span className="avatar" style={{ width: 42, height: 42, fontSize: 17 }}>{c.name[0]}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong>{c.name}</strong>{c.guardian && <span className="small muted"> · ребёнок ({c.guardian})</span>}
              <span className="small muted" style={{ display: 'block' }}>
                {c.phone ?? 'без телефона'}
                {c.lastVisit ? ` · был(а) ${dayMonthShort(c.lastVisit)}` : ''}
              </span>
            </span>
            <span className="stack" style={{ gap: 2, alignItems: 'flex-end', flex: '0 0 auto' }}>
              <span className="small" style={{ fontWeight: 800 }}>{c.visits} виз.</span>
              {c.points > 0 && <span className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>{c.points} б.</span>}
              {c.noShows > 0 && <span className="small" style={{ color: 'var(--danger)', fontWeight: 700 }}>не пришёл: {c.noShows}</span>}
            </span>
          </Link>
        ))}
        {!rows.length && <p className="muted" style={{ margin: 0 }}>{q ? 'Никого не нашли. Проверьте номер или имя.' : 'Клиентов пока нет — они появятся после первых записей.'}</p>}
      </div>
    </main>
  );
}
