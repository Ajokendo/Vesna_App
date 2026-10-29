import 'server-only';
import { cookies, headers } from 'next/headers';
import { makeT, pickLang, type Lang } from '@/lib/i18n';

export async function getLang(): Promise<Lang> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLang(c.get('lang')?.value, h.get('accept-language'));
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: makeT(lang) };
}
