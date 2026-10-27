import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { getMe } from '@/server/me';
import ClientNav from '@/app/ClientNav';
import { mapLink } from '@/lib/map';
import Forget from './Forget';
import InstallCard from '@/app/InstallCard';
import Feedback from '@/app/Feedback';
import LockToggle from './LockToggle';

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
  return (
    <main className="app home">
      <div className="page" style={{ gap: 'clamp(8px, 1.4dvh, 16px)', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', paddingBottom: 12 }}>
        <div className="stack" style={{ gap: 2 }}>
          <h1 style={{ fontSize: 24 }}>Ещё</h1>
          {me && <span className="small muted">Вы вошли как <strong style={{ color: 'var(--ink)' }}>{me.client.name}</strong>{me.client.phone ? `, ${me.client.phone}` : ''}</span>}
        </div>

        {/* связаться — плитками в один ряд, чтобы страница помещалась на экран без прокрутки */}
        <section className="card" style={{ padding: '12px 10px 10px' }} aria-label="Связаться с салоном">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))', gap: 4 }}>
            {wa && <Tile href={`https://wa.me/${wa}`} icon="chat" color="#25D366" title="WhatsApp" external />}
            {tel && <Tile href={`tel:+${tel}`} icon="phone" color="var(--accent)" title="Позвонить" />}
            {salon.instagram && <Tile href={`https://instagram.com/${salon.instagram.replace(/^@/, '')}`} icon="camera" color="linear-gradient(45deg,#f9a03f,#e1306c 55%,#8a3ab9)" title="Instagram" external />}
            <Tile href={mapLink(salon)} icon="pin" color="#2FAD4A" title="Маршрут" external />
          </div>
          <a href={mapLink(salon)} target="_blank" rel="noreferrer" className="small muted" style={{ display: 'block', textAlign: 'center', marginTop: 8, textDecoration: 'none', lineHeight: 1.3 }}>
            📍 {[salon.city, salon.address].filter(Boolean).join(', ')} · <span style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>открыть в 2ГИС</span>
          </a>
        </section>

        <section className="card stack" style={{ gap: 0, padding: 0, overflow: 'hidden' }} aria-label="О приложении">
          <ContactRow href={`/${slug}?intro=1`} icon="info" color="var(--gold)" title="Как пользоваться приложением" sub="Запись, напоминания, баллы, подарки" />
          {salon.certificatesEnabled && <ContactRow href={`/${slug}/gift`} icon="gift" color="#C9A24A" title="Подарочный сертификат" sub="Подарить или проверить свой" line />}
          <ContactRow href={`/${slug}/points`} icon="gift" color="var(--accent)" title="Пригласить друга" sub={salon.referralBonus > 0 ? `${salon.referralBonus} баллов за каждого друга` : 'Поделитесь приложением'} line />
          <Feedback salon={slug} role="CLIENT">
            <ContactRow icon="mail" color="#6B7A8F" title="Написать разработчикам" sub="Ошибка в приложении или идея" line />
          </Feedback>
        </section>

        <InstallCard bonus={me?.client.welcomeBonusAt ? 0 : salon.welcomeBonus} compact />
        {me && <LockToggle slug={slug} />}

        <div className="stack small muted" style={{ gap: 6, marginTop: 'auto', alignItems: 'center', textAlign: 'center' }}>
          {me && <Forget slug={slug} name={me.client.name} />}
          <span className="row" style={{ justifyContent: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
            Для сотрудников:
            <Link href={`/${slug}/master`} className="muted">Кабинет мастера</Link>·
            <Link href={`/${slug}/admin`} className="muted">Администратор</Link>·
            <Link href={`/${slug}/owner`} className="muted">Директор</Link>
          </span>
        </div>
      </div>
      <ClientNav slug={slug} inline />
    </main>
  );
}

/** Плитка контакта: цветной значок и подпись под ним */
function Tile({ href, icon, color, title, external }: { href: string; icon: keyof typeof ICON; color: string; title: string; external?: boolean }) {
  return (
    <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '4px 2px', textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
      <span aria-hidden style={{ width: 46, height: 46, borderRadius: 14, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[icon]} /></svg>
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{title}</span>
    </a>
  );
}

const ICON: Record<string, string> = {
  chat: 'M4 19.5l1.3-3.9A8 8 0 1 1 8.6 19L4 19.5zM9 10h.01M12 10h.01M15 10h.01',
  phone: 'M6.6 3.5l2.6.4 1.3 3.5-1.9 1.4a11 11 0 0 0 6.6 6.6l1.4-1.9 3.5 1.3.4 2.6a2 2 0 0 1-2 2.1A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2.1-2z',
  camera: 'M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10.5H4zM12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1s3 1 5 1zM12 7c1.5-3 5-3.5 5-1s-3 1-5 1z',
};

/** Строка контакта: цветной значок, название, номер/адрес и стрелка */
function ContactRow({ href, icon, color, title, sub, hint, external, line }: {
  href?: string; icon: keyof typeof ICON; color: string; title: string; sub?: string | null; hint?: string; external?: boolean; line?: boolean;
}) {
  return (
    <a href={href} role={href ? undefined : 'button'} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', minHeight: 52, textDecoration: 'none', color: 'inherit',
      borderTop: line ? '1px solid var(--line)' : undefined,
    }}>
      <span aria-hidden style={{ width: 34, height: 34, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICON[icon]} /></svg>
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <strong>{title}</strong>
        {sub && <span className="small muted" style={{ lineHeight: 1.35 }}>{sub}</span>}
        {hint && <span className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>{hint}</span>}
      </span>
      <span aria-hidden className="muted" style={{ fontSize: 20, flex: '0 0 auto' }}>›</span>
    </a>
  );
}
