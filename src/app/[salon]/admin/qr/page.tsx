import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { qrSvg, siteOrigin } from '@/server/qr';
import PrintButton from './PrintButton';
import QrZoom from './QrZoom';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'QR-табличка' };

/** Табличка для ресепшена и зеркал: клиент наводит камеру — открывается запись онлайн */
export default async function QrPoster({ params }: { params: Promise<{ salon: string }> }) {
  const { salon: slug } = await params;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const url = `${await siteOrigin()}/${slug}`;
  const qr = await qrSvg(url);
  return (
    // на экране табличка целиком помещается в высоту телефона (размеры от высоты экрана), при печати — во весь лист
    <main className="safe qr-screen" style={{ padding: '16px 16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
      <article className="poster" style={{
        width: 'min(100%, 520px)', flex: '1 1 auto', minHeight: 0, background: '#fff', border: '2px solid var(--gold)', borderRadius: 20,
        padding: 'clamp(8px, 1.6dvh, 28px) 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly',
        gap: 'clamp(3px, 0.8dvh, 14px)', textAlign: 'center', overflow: 'hidden',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {salon.logoUrl && <img src={salon.logoUrl} alt="" className="p-logo" style={{ width: 'clamp(44px, 9dvh, 96px)', height: 'clamp(44px, 9dvh, 96px)', borderRadius: '50%' }} />}
        <h2 className="p-title" style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(18px, 3.4dvh, 30px)', lineHeight: 1.15, margin: 0 }}>Записывайтесь онлайн<br />и копите баллы</h2>
        <QrZoom svg={qr} className="p-qr" style={{ width: 'min(62vw, 25dvh, 300px)', aspectRatio: '1' }} />
        <div className="p-text" style={{ fontSize: 'clamp(13px, 2dvh, 17px)', fontWeight: 700 }}>Наведите камеру телефона на код</div>
        <ul className="p-text" style={{ textAlign: 'left', margin: 0, paddingLeft: 18, lineHeight: 1.35, fontSize: 'clamp(12px, 1.8dvh, 16px)' }}>
          <li>запись в пару касаний, без звонков</li>
          <li>напоминание о визите</li>
          <li><b>{salon.pointsPercent}% баллами</b> с каждого визита</li>
          {salon.welcomeBonus > 0 && <li><b>{salon.welcomeBonus} баллов в подарок</b> за установку приложения</li>}
        </ul>
        <div className="muted p-text" style={{ fontSize: 'clamp(11px, 1.6dvh, 14px)' }}>Салон «{salon.name}» · {[salon.city, salon.address].filter(Boolean).join(', ')}</div>
      </article>
      <div className="no-print stack" style={{ gap: 6, alignItems: 'center', textAlign: 'center' }}>
        <PrintButton />
        <span className="small muted">Для ресепшена, зеркал, двери · А4 или А5</span>
      </div>
      <style>{`
        /* высота экрана минус нижняя панель администратора */
        .qr-screen { height: calc(100dvh - 76px - env(safe-area-inset-bottom)); }
        .p-qr svg { width: 100%; height: 100%; display: block; }
        @media print {
          @page { margin: 12mm; }
          body { background: #fff !important; }
          .no-print, nav, [aria-hidden] { display: none !important; }
          .qr-screen { height: auto !important; padding: 0 !important; overflow: visible !important; }
          .poster { border-width: 2px !important; width: 100% !important; max-width: none !important; margin-top: 10mm; padding: 32px 28px !important; gap: 16px !important; }
          .p-logo { width: 110px !important; height: 110px !important; }
          .p-title { font-size: 34px !important; }
          .p-qr { width: 300px !important; }
          .p-text { font-size: 17px !important; }
        }`}</style>
    </main>
  );
}
