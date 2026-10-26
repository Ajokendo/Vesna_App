import { NextResponse, type NextRequest } from 'next/server';
import { getMe, meToken } from '@/server/me';
import { getSalon } from '@/server/salon';

// Манифест приложения (название, значок, быстрые пункты на значке).
// Если телефон уже знает клиента, в адрес запуска добавляется его ключ: на iPhone у приложения с экрана «Домой»
// свои cookie, и без ключа оно не узнало бы клиента (а значит, ни записей, ни подарочных баллов).
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('s') ?? 'vesna';
  const salon = await getSalon(slug);
  const me = await getMe(slug).catch(() => null);
  const start = me ? `/${slug}?me=${encodeURIComponent(await meToken(me.client.id))}` : `/${slug}`;
  const manifest = {
    name: salon ? `Салон красоты «${salon.name}»` : 'Салон красоты',
    short_name: salon?.name ?? 'Салон',
    id: `/${slug}`,
    start_url: start,
    scope: '/',
    display: 'standalone',
    background_color: '#F6F6F1',
    theme_color: '#4E6B45',
    lang: 'ru',
    icons: [
      { src: '/icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Кабинет мастера', short_name: 'Мастер', url: `/${slug}/master`, icons: [{ src: '/shortcut-master.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Администратор', short_name: 'Админ', url: `/${slug}/admin`, icons: [{ src: '/shortcut-admin.png', sizes: '192x192', type: 'image/png' }] },
    ],
  };
  return new NextResponse(JSON.stringify(manifest), {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'private, no-store' },
  });
}
