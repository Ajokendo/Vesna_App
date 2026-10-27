import { notFound } from 'next/navigation';
import { getCatalog, getSalon } from '@/server/salon';
import { utcToZoned } from '@/lib/time';
import BookingWizard from './BookingWizard';
import { getMe } from '@/server/me';

export const dynamic = 'force-dynamic';

export default async function BookPage({ params, searchParams }: {
  params: Promise<{ salon: string }>;
  searchParams: Promise<{ hall?: string; staff?: string; service?: string; date?: string; any?: string; length?: string; addons?: string }>;
}) {
  const { salon: slug } = await params;
  const { hall, staff, service, date, any, length, addons } = await searchParams;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const catalog = await getCatalog(salon.id);
  const today = utcToZoned(new Date(), salon.timezone).date;
  // запись к выбранному мастеру (с главной): зал — тот, где у мастера есть услуги
  const master = staff ? catalog.staff.find((m) => m.id === staff) : undefined;
  // ссылка из уведомления листа ожидания: услуга, мастер (или любой) и день уже выбраны
  const svcCat = service ? catalog.categories.find((c) => c.services.some((v) => v.id === service)) : undefined;
  const preset = svcCat && date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today ? {
    serviceId: service!, date, any: any === '1',
    length: (['SHORT', 'MEDIUM', 'LONG', 'XLONG'] as const).find((l) => l === length) ?? null,
    addonIds: addons ? addons.split(',').filter((id) => svcCat.addons.some((a) => a.id === id)) : [],
  } : null;
  const me = await getMe(slug).catch(() => null);
  const masterHalls = master ? (['MEN', 'WOMEN'] as const).filter((h) => catalog.categories.some((c) => c.hall === h && c.staffIds.includes(master.id))) : [];
  return (
    <BookingWizard
      slug={slug}
      salonName={salon.name}
      address={`${salon.city}, ${salon.address}`}
      today={today}
      horizonDays={salon.bookingHorizonDays}
      initialHall={preset && svcCat ? svcCat.hall : master && masterHalls.length ? masterHalls[0] : hall === 'WOMEN' || hall === 'MEN' ? hall : catalog.categories.some((c) => c.hall === 'MEN') ? 'MEN' : 'WOMEN'}
      presetStaffId={master?.id ?? null}
      preset={preset}
      me={me && !me.client.guardianId ? { name: me.client.name, phone: me.client.phone ?? '' } : null}
      catalog={catalog}
      welcomeBonus={salon.welcomeBonus}
    />
  );
}
