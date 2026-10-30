import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getManageData } from '@/server/manage';
import SalonForm from './SalonForm';
import ServicesEditor from './ServicesEditor';
import StaffEditor from './StaffEditor';
import PinList from './PinList';
import ReviewsList from './ReviewsList';
import Feedback from '@/app/Feedback';
import Certificates from './Certificates';
import { CERT_STATUS, listCertificates } from '@/server/certificates';
import { siteOrigin } from '@/server/qr';
import { dayMonthShort, utcToZoned } from '@/lib/time';
import { waProviderReady } from '@/server/whatsapp';

export const dynamic = 'force-dynamic';

const TABS = [
  { id: 'salon', name: 'Салон' },
  { id: 'services', name: 'Услуги' },
  { id: 'staff', name: 'Мастера' },
  { id: 'pins', name: 'PIN-коды' },
  { id: 'reviews', name: 'Оценки' },
  { id: 'certs', name: 'Сертификаты' },
] as const;

export default async function Settings({ params, searchParams }: { params: Promise<{ salon: string }>; searchParams: Promise<{ tab?: string; ok?: string; e?: string }> }) {
  const { salon: slug } = await params;
  const sp = await searchParams;
  const t = sp.tab;
  const tab = TABS.find((x) => x.id === t)?.id ?? 'salon';
  let data;
  try { data = await getManageData(slug); } catch { notFound(); }
  return (
    <main className="safe" style={{ padding: '24px 28px 48px', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <header>
        <h1 style={{ fontSize: 26 }}>Настройки салона</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>Изменения сразу видны клиентам в онлайн-записи и в журнале.</p>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Link href={`/${slug}/owner`} className="btn" style={{ minHeight: 42, fontSize: 14 }}>📊 Кабинет директора</Link>
          <Link href={`/${slug}/help?r=admin`} className="btn" style={{ minHeight: 42, fontSize: 14 }}>❓ Инструкция</Link>
          <Link href={`/${slug}/admin/qr`} className="btn" style={{ minHeight: 42, fontSize: 14 }}>▣ QR-табличка для ресепшена</Link>
          <Feedback salon={slug} role="ADMIN"><button type="button" className="btn" style={{ minHeight: 42, fontSize: 14 }}>✉ Написать разработчикам</button></Feedback>
        </div>
      </header>
      <nav className="tabs" style={{ width: '100%', maxWidth: 720, gridAutoFlow: 'row', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {TABS.map((x) => (
          <Link key={x.id} href={`/${slug}/admin/settings?tab=${x.id}`} aria-current={x.id === tab ? 'page' : undefined}
            style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4px 3px', fontSize: 13, lineHeight: 1.2, borderRadius: 12, fontWeight: 800, textDecoration: 'none', color: x.id === tab ? 'var(--ink)' : 'var(--muted)', background: x.id === tab ? '#fff' : 'transparent' }}>
            {x.name}
          </Link>
        ))}
      </nav>
      {tab === 'salon' && <SalonForm slug={slug} salon={data.salon} waReady={waProviderReady(data.salon)} />}
      {tab === 'services' && <ServicesEditor slug={slug} categories={data.categories} />}
      {tab === 'reviews' && <ReviewsList slug={slug} />}
      {tab === 'certs' && await (async () => {
        const { salon, rows } = await listCertificates(slug);
        const d = (x: Date) => { const z = utcToZoned(x, salon.timezone).date; return `${dayMonthShort(z)} ${z.slice(0, 4)}`; };
        return <Certificates slug={slug} salonName={salon.name} enabled={salon.certificatesEnabled} months={salon.certificateMonths} origin={await siteOrigin()}
          rows={rows.map((r) => ({ id: r.id, code: r.code, amount: r.amount, balance: r.balance, toName: r.toName, fromName: r.fromName, buyerPhone: r.buyerPhone, sold: d(r.soldAt), expires: d(r.expiresAt), status: r.status, statusName: CERT_STATUS[r.status] }))} />;
      })()}
      {tab === 'pins' && <PinList slug={slug} salonId={data.salon.id} sp={sp} />}
      {tab === 'staff' && <StaffEditor slug={slug} staff={data.staff} categories={data.categories} defaultCommission={data.salon.defaultCommission} />}
    </main>
  );
}
