import { NextResponse } from 'next/server';
import { vapidKeys } from '@/server/push';

export const dynamic = 'force-dynamic';

/** Открытый ключ для подписки телефона на уведомления */
export async function GET() {
  return NextResponse.json({ publicKey: (await vapidKeys()).publicKey });
}
