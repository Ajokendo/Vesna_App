import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCatalog, getSalon } from '@/server/salon';

export const dynamic = 'force-dynamic';

export default async function SalonHome({ params }: { params: Promise<{ salon: string }> }) {
  const { salon: slug } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const { staff } = await getCatalog(salon.id);

  return (
    <main className="app">
      <div className="page">
        <header className="row">
          {salon.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={salon.logoUrl} alt={`Логотип салона «${salon.name}»`} width={52} height={52} style={{ borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--ground)' }} />
          ) : null}
          <div className="grow">
            <h1 style={{ fontSize: 22 }}>{salon.name}</h1>
            <div className="muted small">{salon.tagline} · {salon.city}</div>
          </div>
        </header>

        <section className="stack">
          <h2 style={{ fontSize: 22 }}>Запишитесь онлайн</h2>
          <p className="muted" style={{ margin: 0 }}>Выберите услугу, мастера и удобное время — без звонков.</p>
          <div className="grid2">
            <Link href={`/${slug}/book?hall=MEN`} className="card" style={{ background: '#e4ebdd', textDecoration: 'none', color: 'inherit', minHeight: 92, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <strong style={{ fontSize: 17 }}>Мужской зал</strong>
              <span className="small muted">Стрижки, борода, детские</span>
            </Link>
            <Link href={`/${slug}/book?hall=WOMEN`} className="card" style={{ background: 'var(--cream)', textDecoration: 'none', color: 'inherit', minHeight: 92, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <strong style={{ fontSize: 17 }}>Женский зал</strong>
              <span className="small muted">Волосы, ногти, брови, шугаринг</span>
            </Link>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 18 }}>Наши мастера</h2>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {staff.map((m) => (
              <div key={m.id} className="card" style={{ flex: '0 0 120px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 8px' }}>
                <div className="avatar" style={{ width: 60, height: 60 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.photoUrl ? <img src={m.photoUrl} alt={m.name} /> : m.name[0]}
                </div>
                <strong>{m.name}</strong>
                <span className="small muted" style={{ lineHeight: 1.25, fontSize: 13 }}>{m.title?.split(',')[0]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card row" style={{ borderColor: 'var(--gold)', gap: 12, padding: '12px 14px', flexWrap: 'wrap' }}>
          <div className="stack small" style={{ gap: 2, flex: '1 1 180px' }}>
            <strong style={{ fontSize: 15 }}>{salon.city}, {salon.address}</strong>
            <span className="muted">С 09:00 до 20:00, у каждого мастера свой график</span>
          </div>
          {salon.whatsapp ? (
            <a className="btn" style={{ minHeight: 42, padding: '0 14px', fontSize: 14 }} href={`https://wa.me/${salon.whatsapp.replace(/\D/g, '')}`}>WhatsApp</a>
          ) : null}
        </section>
        {/* вход для сотрудников: прилипает к низу экрана, виден сразу без прокрутки */}
        <nav aria-label="Для сотрудников" style={{
          position: 'sticky', bottom: 0, zIndex: 10, margin: '0 -20px calc(-32px - env(safe-area-inset-bottom))',
          padding: '10px 20px calc(10px + env(safe-area-inset-bottom))', background: 'rgba(247,248,244,.96)', borderTop: '1px solid var(--line)',
          backdropFilter: 'blur(6px)',
        }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <Link href={`/${salon.slug}/master`} className="btn" style={{ flex: 1, minHeight: 44, fontSize: 14, padding: '0 8px', whiteSpace: 'nowrap' }}>Кабинет мастера</Link>
            <Link href={`/${salon.slug}/admin`} className="btn" style={{ flex: 1, minHeight: 44, fontSize: 14, padding: '0 8px', whiteSpace: 'nowrap' }}>Администратор</Link>
          </div>
        </nav>
      </div>
    </main>
  );
}
