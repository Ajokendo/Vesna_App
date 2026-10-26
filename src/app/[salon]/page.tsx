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
            <img src={salon.logoUrl} alt={`Логотип салона «${salon.name}»`} width={52} height={52} style={{ borderRadius: '50%', border: '1px solid var(--line)', background: '#fff' }} />
          ) : null}
          <div className="grow">
            <h1 style={{ fontSize: 22 }}>{salon.name}</h1>
            <div className="muted small">{salon.tagline} · {salon.city}</div>
          </div>
        </header>

        <section className="stack">
          <h2 style={{ fontSize: 24 }}>Запишитесь онлайн</h2>
          <p className="muted" style={{ margin: 0 }}>Выберите услугу, мастера и удобное время — без звонков.</p>
          <div className="grid2">
            <Link href={`/${slug}/book?hall=MEN`} className="card" style={{ background: '#e4ebdd', textDecoration: 'none', color: 'inherit', minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <strong style={{ fontSize: 17 }}>Мужской зал</strong>
              <span className="small muted">Стрижки, борода, детские</span>
            </Link>
            <Link href={`/${slug}/book?hall=WOMEN`} className="card" style={{ background: 'var(--cream)', textDecoration: 'none', color: 'inherit', minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <strong style={{ fontSize: 17 }}>Женский зал</strong>
              <span className="small muted">Волосы, ногти, брови, шугаринг</span>
            </Link>
          </div>
        </section>

        <section className="stack">
          <h2 style={{ fontSize: 18 }}>Наши мастера</h2>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {staff.map((m) => (
              <div key={m.id} className="card" style={{ flex: '0 0 140px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div className="avatar" style={{ width: 72, height: 72 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.photoUrl ? <img src={m.photoUrl} alt={m.name} /> : m.name[0]}
                </div>
                <strong>{m.name}</strong>
                <span className="small muted" style={{ lineHeight: 1.3 }}>{m.title?.split(',')[0]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card" style={{ borderColor: 'var(--gold)' }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Салон «{salon.name}»</h2>
          <div className="stack small">
            <span>{salon.city}, {salon.address}</span>
            <span className="muted">С 09:00 до 20:00, у каждого мастера свой график</span>
            {salon.whatsapp ? (
              <a className="btn" href={`https://wa.me/${salon.whatsapp.replace(/\D/g, '')}`}>Написать в WhatsApp</a>
            ) : null}
          </div>
        </section>
        <nav className="stack" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 16 }} aria-label="Для сотрудников">
          <span className="small muted" style={{ textAlign: 'center' }}>Для сотрудников салона</span>
          <div className="grid2">
            <Link href={`/${salon.slug}/master`} className="btn" style={{ minHeight: 48, fontSize: 15, padding: '0 10px' }}>Кабинет мастера</Link>
            <Link href={`/${salon.slug}/admin`} className="btn" style={{ minHeight: 48, fontSize: 15, padding: '0 10px' }}>Администратор</Link>
          </div>
        </nav>
      </div>
    </main>
  );
}
