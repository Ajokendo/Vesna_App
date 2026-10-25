import { notFound } from 'next/navigation';
import { getCatalog, getSalon } from '@/server/salon';
import { utcToZoned } from '@/lib/time';
import BookingWizard from './BookingWizard';

export const dynamic = 'force-dynamic';

export default async function BookPage({ params, searchParams }: {
  params: Promise<{ salon: string }>;
  searchParams: Promise<{ hall?: string }>;
}) {
  const { salon: slug } = await params;
  const { hall } = await searchParams;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const catalog = await getCatalog(salon.id);
  const today = utcToZoned(new Date(), salon.timezone).date;
  return (
    <BookingWizard
      slug={slug}
      salonName={salon.name}
      address={`${salon.city}, ${salon.address}`}
      today={today}
      horizonDays={salon.bookingHorizonDays}
      initialHall={hall === 'WOMEN' ? 'WOMEN' : 'MEN'}
      catalog={catalog}
    />
  );
}
