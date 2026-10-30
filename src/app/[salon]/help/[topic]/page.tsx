import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HELP } from '@/lib/help';

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const t = HELP.find((x) => x.id === topic);
  return { title: t ? `${t.title} — инструкция` : 'Инструкция' };
}

/** Одна тема инструкции: шаги по одному на строку, подсказка, скриншоты; внизу — соседние темы */
export default async function HelpTopic({ params, searchParams }: { params: Promise<{ salon: string; topic: string }>; searchParams: Promise<{ r?: string }> }) {
  const { salon: slug, topic } = await params;
  const { r = 'admin' } = await searchParams;
  const t = HELP.find((x) => x.id === topic);
  if (!t) notFound();
  const list = HELP.filter((x) => x.role === t.role);
  const i = list.indexOf(t);
  const prev = list[i - 1]; const next = list[i + 1];
  const href = (x: typeof t) => `/${slug}/help/${x.id}?r=${r}`;
  return (
    <main className="app">
      <div className="page" style={{ gap: 14 }}>
        <Link href={`/${slug}/help?r=${r}`} className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>‹ Все темы</Link>
        <header className="row" style={{ gap: 10 }}>
          <span aria-hidden style={{ fontSize: 34 }}>{t.icon}</span>
          <div><h1 style={{ fontSize: 24 }}>{t.title}</h1><span className="small muted">{t.sub}</span></div>
        </header>
        <ol className="card stack" style={{ gap: 10, margin: 0, paddingLeft: 16, listStyle: 'none' }}>
          {t.steps.map((s, k) => (
            <li key={k} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 8, alignItems: 'start', lineHeight: 1.4 }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 13, display: 'grid', placeItems: 'center' }}>{k + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        {t.tip && <div className="note">💡 {t.tip}</div>}
        <div className="stack" style={{ gap: 14 }}>
          {t.shots.map((s) => (
            <figure key={s.src} style={{ margin: 0, alignSelf: s.wide ? 'stretch' : 'center', width: s.wide ? '100%' : 'min(100%, 360px)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={`/help/${s.src}.jpg`} target="_blank" rel="noreferrer" aria-label={`${s.alt} — открыть крупно`}>
                <img src={`/help/${s.src}.jpg`} alt={s.alt} loading="lazy" style={{ width: '100%', display: 'block', borderRadius: 16, border: '1px solid var(--line)', boxShadow: '0 4px 18px rgba(30,40,30,.08)' }} />
              </a>
              <figcaption className="small muted" style={{ textAlign: 'center', marginTop: 6 }}>{s.alt}{s.wide ? ' · нажмите, чтобы открыть крупно' : ''}</figcaption>
            </figure>
          ))}
        </div>
        <nav className="row" style={{ gap: 8, justifyContent: 'space-between', marginTop: 6 }}>
          {prev ? <Link href={href(prev)} className="btn" style={{ minHeight: 44 }}>‹ {prev.title}</Link> : <span />}
          {next ? <Link href={href(next)} className="btn primary" style={{ minHeight: 44 }}>{next.title} ›</Link> : <Link href={`/${slug}/help?r=${r}`} className="btn" style={{ minHeight: 44 }}>Все темы</Link>}
        </nav>
      </div>
    </main>
  );
}
