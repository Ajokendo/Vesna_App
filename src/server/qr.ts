import 'server-only';
import { headers } from 'next/headers';
import QRCode from 'qrcode';

/** Адрес сайта, с которого открыта страница (для ссылок в QR) */
export async function siteOrigin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** QR-код в виде SVG (вставляется прямо в страницу, печатается чётко) */
export function qrSvg(text: string) {
  return QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#24331f', light: '#ffffff' } });
}

/** Что зашито в личный QR клиента: ссылка на его карточку в разделе администратора */
export function clientQrUrl(origin: string, slug: string, clientId: string) {
  return `${origin}/${slug}/admin/clients/${clientId}`;
}
