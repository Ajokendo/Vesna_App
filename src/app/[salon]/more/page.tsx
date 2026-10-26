import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { getMe } from '@/server/me';
import ClientNav from '@/app/ClientNav';
import { mapLink } from '@/lib/map';
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
  return (
    <main className="app home">
      <div className="page" style={{ gap: 16, flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <h1 style={{ fontSize: 24 }}>Ещё</h1>
        {me && <span className="muted">Вы вошли как <strong style={{ color: 'var(--ink)' }}>{me.client.name}</strong>{me.client.phone ? `, ${me.client.phone}` : ''}</span>}

        <section className="card stack" style={{ gap: 0, padding: 0, overflow: 'hidden' }} aria-label="Связаться с салоном">
          {wa && <ContactRow href={`https://wa.me/${wa}`} icon="chat" color="#25D366" title="WhatsApp" sub={salon.whatsapp} external />}
          {tel && <ContactRow href={`tel:+${tel}`} icon="phone" color="var(--accent)" title="Позвонить" sub={salon.phone} line />}
          {salon.instagram && <ContactRow href={`https://instagram.com/${salon.instagram.replace(/^@/, '')}`} icon="camera" color="linear-gradient(45deg,#f9a03f,#e1306c 55%,#8a3ab9)" title="Instagram" sub={`@${salon.instagram.replace(/^@/, '')}`} external line />}
          <ContactRow href={mapLink(salon)} icon="pin" color="#2FAD4A" title="Как добраться" sub={[salon.city, salon.address].filter(Boolean).join(', ')} hint="открыть в 2ГИС и проложить маршрут" external line />
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
      <ClientNav slug={slug} inline />
    </main>
  );
}

const ICON: Record<string, string> = {
  chat: 'M4 19.5l1.3-3.9A8 8 0 1 1 8.6 19L4 19.5zM9 10h.01M12 10h.01M15 10h.01',
  phone: 'M6.6 3.5l2.6.4 1.3 3.5-1.9 1.4a11 11 0 0 0 6.6 6.6l1.4-1.9 3.5 1.3.4 2.6a2 2 0 0 1-2 2.1A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2.1-2z',
  camera: 'M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10.5H4zM12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z',
};

/** Строка контакта: цветной значок, название, номер/адрес и стрелка */
function ContactRow({ href, icon, color, title, sub, hint, external, line }: {
  href: string; icon: keyof typeof ICON; color: string; title: string; sub?: string | null; hint?: string; external?: boolean; line?: boolean;
}) {
  return (
    <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', minHeight: 60, textDecoration: 'none', color: 'inherit',
      borderTop: line ? '1px solid var(--line)' : undefined,
    }}>
      <span aria-hidden style={{ width: 38, height: 38, borderRadius: 11, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
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
