import { notFound } from 'next/navigation';
import { getCatalog, getSalon } from '@/server/salon';
import { utcToZoned } from '@/lib/time';
import BookingWizard from './BookingWizard';

export const dynamic = 'force-dynamic';

export default async function BookPage({ params, searchParams }: {
  params: Promise<{ salon: string }>;
  searchParams: Promise<{ hall?: string; staff?: string }>;
}) {
  const { salon: slug } = await params;
  const { hall, staff } = await searchParams;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const catalog = await getCatalog(salon.id);
  const today = utcToZoned(new Date(), salon.timezone).date;
  // запись к выбранному мастеру (с главной): зал — тот, где у мастера есть услуги
  const master = staff ? catalog.staff.find((m) => m.id === staff) : undefined;
  const masterHalls = master ? (['MEN', 'WOMEN'] as const).filter((h) => catalog.categories.some((c) => c.hall === h && c.staffIds.includes(master.id))) : [];
  return (
    <BookingWizard
      slug={slug}
      salonName={salon.name}
      address={`${salon.city}, ${salon.address}`}
      today={today}
      horizonDays={salon.bookingHorizonDays}
      initialHall={master && masterHalls.length ? masterHalls[0] : hall === 'WOMEN' || hall === 'MEN' ? hall : catalog.categories.some((c) => c.hall === 'MEN') ? 'MEN' : 'WOMEN'}
      presetStaffId={master?.id ?? null}
      catalog={catalog}
      welcomeBonus={salon.welcomeBonus}
    />
  );
}
