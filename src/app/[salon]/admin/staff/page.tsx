import { redirect } from 'next/navigation';

/** PIN-коды мастеров перенесены в «Настройки» */
export default async function StaffPins({ params }: { params: Promise<{ salon: string }> }) {
  const { salon } = await params;
  redirect(`/${salon}/admin/settings?tab=pins`);
}
