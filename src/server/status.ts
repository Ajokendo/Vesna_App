import { notInArray } from 'drizzle-orm';
import { schema as s } from '@/db';

/** Запись занимает время мастера: не отменена и клиент не отмечен как «не пришёл» */
export const occupiesTime = () => notInArray(s.appointments.status, ['CANCELLED', 'NO_SHOW']);
