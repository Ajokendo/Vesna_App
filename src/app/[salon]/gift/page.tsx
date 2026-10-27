import { notFound, redirect } from 'next/navigation';
import { getSalon } from '@/server/salon';
import ClientNav from '@/app/ClientNav';
import CheckCode from './CheckCode';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Подарочный сертификат' };

/** Для клиентов: как купить подарочный сертификат и проверить свой по коду */
export default async function Gift({ params }: { params: Promise<{ salon: string }> }) {
  const { salon: slug } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  if (!salon.certificatesEnabled) redirect(`/${slug}/more`);
  const wa = salon.whatsapp?.replace(/\D/g, '');
  const text = `Здравствуйте! Хочу купить подарочный сертификат салона «${salon.name}».`;
  return (
    <main className="app home">
      <div className="page" style={{ gap: 16, flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <h1 style={{ fontSize: 24 }}>🎁 Подарочный сертификат</h1>
        <section className="card stack" style={{ gap: 8, background: 'linear-gradient(160deg,#fff,#f7f1e3)', borderColor: 'var(--gold)' }}>
          <strong style={{ fontSize: 17 }}>Подарите красоту</strong>
          <span className="muted" style={{ lineHeight: 1.5 }}>
            Сертификат на любую сумму — на любые услуги салона «{salon.name}». Его можно потратить за один или несколько визитов, остаток сохраняется. Действует {salon.certificateMonths} мес.
          </span>
          <span className="small" style={{ lineHeight: 1.5 }}>Купить можно в салоне или написать нам — пришлём красивый сертификат ссылкой, его удобно переслать или распечатать.</span>
          {wa && <a className="btn primary" href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">Написать в WhatsApp</a>}
        </section>
        <CheckCode slug={slug} />
      </div>
      <ClientNav slug={slug} inline />
    </main>
  );
}
