import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { getMe } from '@/server/me';
import ClientNav from '@/app/ClientNav';
import Forget from './Forget';
import InstallCard from '@/app/InstallCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ещё' };

/** Контакты салона, как установить приложение, «не мой телефон» и (мелко) вход для сотрудников */
export default async function More({ params }: { params: Promise<{ salon: string }> }) {
  const { salon: slug } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const me = await getMe(slug);
  const wa = salon.whatsapp?.replace(/\D/g, '');
  const tel = salon.phone?.replace(/\D/g, '');
  const row = { justifyContent: 'space-between', minHeight: 52, padding: '0 16px', textDecoration: 'none', color: 'inherit' } as const;
  return (
    <main className="app">
      <div className="page" style={{ gap: 16 }}>
        <h1 style={{ fontSize: 24 }}>Ещё</h1>
        {me && <span className="muted">Вы вошли как <strong style={{ color: 'var(--ink)' }}>{me.client.name}</strong>{me.client.phone ? `, ${me.client.phone}` : ''}</span>}

        <section className="card stack" style={{ gap: 0, padding: 0, overflow: 'hidden' }} aria-label="Связаться с салоном">
          {wa && <a className="row" style={row} href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><strong>WhatsApp</strong><span className="muted">{salon.whatsapp}</span></a>}
          {tel && <a className="row" style={{ ...row, borderTop: '1px solid var(--line)' }} href={`tel:+${tel}`}><strong>Позвонить</strong><span className="muted">{salon.phone}</span></a>}
          {salon.instagram && <a className="row" style={{ ...row, borderTop: '1px solid var(--line)' }} href={`https://instagram.com/${salon.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer"><strong>Instagram</strong><span className="muted">@{salon.instagram.replace(/^@/, '')}</span></a>}
          <div className="row" style={{ ...row, borderTop: '1px solid var(--line)', minHeight: 'auto', padding: '12px 16px', alignItems: 'flex-start', gap: 12 }}>
            <strong>Адрес</strong><span className="muted" style={{ textAlign: 'right' }}>{[salon.city, salon.address].filter(Boolean).join(', ')}{salon.hoursText ? <><br />{salon.hoursText}</> : null}</span>
          </div>
        </section>

        <InstallCard bonus={me?.client.welcomeBonusAt ? 0 : salon.welcomeBonus} />

        {me && <Forget slug={slug} name={me.client.name} />}

        <div className="stack small muted" style={{ gap: 4, marginTop: 8, textAlign: 'center' }}>
          <span>Для сотрудников салона: подержите палец на значке приложения или войдите здесь —</span>
          <span className="row" style={{ justifyContent: 'center', gap: 14 }}>
            <Link href={`/${slug}/master`} className="muted">Кабинет мастера</Link>
            <Link href={`/${slug}/admin`} className="muted">Администратор</Link>
          </span>
        </div>
      </div>
      <ClientNav slug={slug} />
    </main>
  );
}
