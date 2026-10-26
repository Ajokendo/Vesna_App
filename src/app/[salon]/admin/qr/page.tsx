import { notFound } from 'next/navigation';
import { getSalon } from '@/server/salon';
import { qrSvg, siteOrigin } from '@/server/qr';
import PrintButton from './PrintButton';

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
    <main className="safe" style={{ padding: '24px 28px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div className="no-print stack" style={{ gap: 8, maxWidth: 520, width: '100%' }}>
        <h1 style={{ fontSize: 24 }}>QR-табличка для салона</h1>
        <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Распечатайте и поставьте на ресепшен, у зеркал, на дверь. Клиент наводит камеру телефона — открывается приложение салона:
          запись онлайн, напоминания и баллы. Печатайте на листе А4 или А5.
        </p>
        <PrintButton />
      </div>
      <article className="poster" style={{
        width: 'min(100%, 520px)', background: '#fff', border: '2px solid var(--gold)', borderRadius: 24, padding: '32px 28px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {salon.logoUrl && <img src={salon.logoUrl} alt="" width={96} height={96} style={{ borderRadius: '50%' }} />}
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 30, lineHeight: 1.15, margin: 0 }}>Записывайтесь онлайн<br />и копите баллы</h2>
        <div style={{ width: '72%', maxWidth: 300 }} dangerouslySetInnerHTML={{ __html: qr }} />
        <div style={{ fontSize: 17, lineHeight: 1.5 }}>
          Наведите камеру телефона на код
        </div>
        <ul style={{ textAlign: 'left', margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 16 }}>
          <li>запись в пару касаний, без звонков</li>
          <li>напоминание о визите</li>
          <li><b>{salon.pointsPercent}% баллами</b> с каждого визита</li>
          {salon.welcomeBonus > 0 && <li><b>{salon.welcomeBonus} баллов в подарок</b> за установку приложения</li>}
        </ul>
        <div className="muted" style={{ fontSize: 14 }}>Салон «{salon.name}» · {[salon.city, salon.address].filter(Boolean).join(', ')}</div>
      </article>
      <style>{`@media print {
        @page { margin: 12mm; }
        body { background: #fff !important; }
        .no-print, nav { display: none !important; }
        main { padding: 0 !important; }
        .poster { border-width: 2px !important; width: 100% !important; max-width: none !important; margin-top: 10mm; }
      }`}</style>
    </main>
  );
}
