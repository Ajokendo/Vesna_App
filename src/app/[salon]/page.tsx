import Link from 'next/link';
import { notFound } from 'next/navigation';
import ClientNav from '@/app/ClientNav';
import { mapLink } from '@/lib/map';
import { getCatalog, getSalon } from '@/server/salon';

export const dynamic = 'force-dynamic';

export default async function SalonHome({ params }: { params: Promise<{ salon: string }> }) {
  const { salon: slug } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const { staff, categories } = await getCatalog(salon.id);
  const halls = (['MEN', 'WOMEN'] as const).filter((h) => categories.some((c) => c.hall === h));

  return (
    // Экран фиксированной высоты: страница не «ездит» пальцем; если на маленьком телефоне что-то не влезает,
    // прокручивается только середина, а кнопки сотрудников всегда внизу
    <main className="app home">
      <div className="page" style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', paddingBottom: 16, justifyContent: 'space-evenly' }}>
        <header className="row">
          {salon.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={salon.logoUrl} alt={`Логотип салона «${salon.name}»`} width={52} height={52} style={{ borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--ground)' }} />
          ) : (
            <span aria-hidden style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 700 }}>{salon.name[0]}</span>
          )}
          <div className="grow">
            <h1 style={{ fontSize: 22 }}>{salon.name}</h1>
            <div className="muted small">{salon.tagline} · {salon.city}</div>
          </div>
        </header>

        <section className="stack">
          <h2 style={{ fontSize: 22 }}>Запишитесь онлайн</h2>
          <p className="muted" style={{ margin: 0 }}>Выберите услугу, мастера и удобное время — без звонков.</p>
          <div className="grid2">
            {halls.map((h) => (
              <Link key={h} href={`/${slug}/book?hall=${h}`} className="card" style={{
                background: h === 'MEN' ? 'var(--accent-soft)' : 'var(--cream)', textDecoration: 'none', color: 'inherit', minHeight: 'clamp(92px, 16dvh, 170px)',
                display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gridColumn: halls.length === 1 ? '1 / -1' : undefined,
              }}>
                <strong style={{ fontSize: 17 }}>{halls.length === 1 ? 'Выбрать услугу' : h === 'MEN' ? 'Мужской зал' : 'Женский зал'}</strong>
                <span className="small muted">{(h === 'MEN' ? salon.menHallNote : salon.womenHallNote) ?? categories.filter((c) => c.hall === h).slice(0, 3).map((c) => c.name.toLowerCase()).join(', ')}</span>
              </Link>
            ))}
          </div>
        </section>

        {staff.length > 0 && (
        <section className="stack">
          <h2 style={{ fontSize: 18 }}>Наши мастера</h2>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {staff.map((m) => (
              <div key={m.id} className="card" style={{ flex: '0 0 120px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 8px' }}>
                <div className="avatar" style={{ width: 'clamp(60px, 9dvh, 88px)', height: 'clamp(60px, 9dvh, 88px)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.photoUrl ? <img src={m.photoUrl} alt={m.name} /> : m.name[0]}
                </div>
                <strong>{m.name}</strong>
                <span className="small muted" style={{ lineHeight: 1.25, fontSize: 13 }}>{m.title?.split(',')[0]}</span>
              </div>
            ))}
          </div>
        </section>
        )}

        <section className="card row" style={{ borderColor: 'var(--gold)', gap: 12, padding: '12px 14px', flexWrap: 'wrap' }}>
          <div className="stack small" style={{ gap: 2, flex: '1 1 180px' }}>
            <a href={mapLink(salon)} target="_blank" rel="noreferrer" style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>📍 {salon.city}, {salon.address}</a>
            {salon.hoursText && <span className="muted">{salon.hoursText}</span>}
          </div>
          {salon.whatsapp ? (
            <a className="btn" style={{ minHeight: 42, padding: '0 14px', fontSize: 14 }} href={`https://wa.me/${salon.whatsapp.replace(/\D/g, '')}`}>WhatsApp</a>
          ) : null}
        </section>
      </div>
      <ClientNav slug={slug} inline />
    </main>
  );
}
