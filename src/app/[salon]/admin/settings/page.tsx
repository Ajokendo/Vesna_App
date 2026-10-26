import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getManageData } from '@/server/manage';
import SalonForm from './SalonForm';
import ServicesEditor from './ServicesEditor';
import StaffEditor from './StaffEditor';

export const dynamic = 'force-dynamic';

const TABS = [
  { id: 'salon', name: 'Салон и правила' },
  { id: 'services', name: 'Услуги и цены' },
  { id: 'staff', name: 'Мастера и графики' },
] as const;

export default async function Settings({ params, searchParams }: { params: Promise<{ salon: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { salon: slug } = await params;
  const { tab: t } = await searchParams;
  const tab = TABS.find((x) => x.id === t)?.id ?? 'salon';
  let data;
  try { data = await getManageData(slug); } catch { notFound(); }
  return (
    <main style={{ padding: '24px 28px 48px', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Link href={`/${slug}/admin`} className="small muted">‹ Журнал</Link>
      <header>
        <h1 style={{ fontSize: 26 }}>Настройки салона</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>Изменения сразу видны клиентам в онлайн-записи и в журнале.</p>
      </header>
      <nav className="tabs" style={{ alignSelf: 'flex-start' }}>
        {TABS.map((x) => (
          <Link key={x.id} href={`/${slug}/admin/settings?tab=${x.id}`} aria-current={x.id === tab ? 'page' : undefined}
            style={{ minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 16px', borderRadius: 12, fontWeight: 800, textDecoration: 'none', color: x.id === tab ? 'var(--ink)' : 'var(--muted)', background: x.id === tab ? '#fff' : 'transparent' }}>
            {x.name}
          </Link>
        ))}
      </nav>
      {tab === 'salon' && <SalonForm slug={slug} salon={data.salon} />}
      {tab === 'services' && <ServicesEditor slug={slug} categories={data.categories} />}
      {tab === 'staff' && <StaffEditor slug={slug} staff={data.staff} categories={data.categories} defaultCommission={data.salon.defaultCommission} />}
    </main>
  );
}
