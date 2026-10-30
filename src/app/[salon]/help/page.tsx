import Link from 'next/link';
import { HELP, HELP_ROLES, type HelpRole } from '@/lib/help';

export const metadata = { title: 'Инструкция' };

const BACK: Record<string, { href: string; name: string }> = {
  admin: { href: 'admin', name: 'В журнал' }, master: { href: 'master', name: 'В кабинет мастера' }, owner: { href: 'owner', name: 'В кабинет директора' },
};

/** Инструкция для сотрудников: темы по ролям, у каждой — короткие шаги и скриншоты */
export default async function Help({ params, searchParams }: { params: Promise<{ salon: string }>; searchParams: Promise<{ r?: string }> }) {
  const { salon: slug } = await params;
  const { r } = await searchParams;
  const role = (HELP_ROLES.some((x) => x.id === r) ? r : 'admin') as Exclude<HelpRole, 'all'>;
  const topics = HELP.filter((t) => t.role === role);
  const common = HELP.filter((t) => t.role === 'all');
  const card = (t: (typeof HELP)[number]) => (
    <Link key={t.id} href={`/${slug}/help/${t.id}?r=${role}`} className="card row press" style={{ gap: 12, textDecoration: 'none', color: 'var(--ink)', padding: '12px 14px' }}>
      <span aria-hidden style={{ fontSize: 26, width: 36, textAlign: 'center' }}>{t.icon}</span>
      <span className="grow stack" style={{ gap: 1 }}>
        <strong>{t.title}</strong>
        <span className="small muted">{t.sub}</span>
      </span>
      <span aria-hidden className="muted" style={{ fontSize: 22 }}>›</span>
    </Link>
  );
  return (
    <main className="app">
      <div className="page" style={{ gap: 14 }}>
        <Link href={`/${slug}/${BACK[role].href}`} className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>‹ {BACK[role].name}</Link>
        <h1 style={{ fontSize: 26 }}>Инструкция</h1>
        <div className="tabs" role="group" aria-label="Для кого">
          {HELP_ROLES.map((x) => <Link key={x.id} href={`/${slug}/help?r=${x.id}`} aria-pressed={x.id === role} className="tab-link" style={{ textAlign: 'center', textDecoration: 'none' }}>{x.name}</Link>)}
        </div>
        <div className="stack" style={{ gap: 8 }}>{topics.map(card)}</div>
        <h2 style={{ fontSize: 18, marginTop: 6 }}>Для всех</h2>
        <div className="stack" style={{ gap: 8 }}>{common.map(card)}</div>
      </div>
    </main>
  );
}
