import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { makeT, pickLang, type Lang } from '@/lib/i18n';

export async function getLang(): Promise<Lang> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLang(c.get('lang')?.value, h.get('accept-language'));
}

/** Кыргызские названия, которые салон вписал сам: русское название → кыргызское */
export const salonKy = cache(async (slug: string): Promise<Record<string, string>> => {
  const salon = await db.query.salons.findFirst({ where: eq(s.salons.slug, slug), columns: { id: true } });
  if (!salon) return {};
  const [cats, staff] = await Promise.all([
    db.query.serviceCategories.findMany({ where: eq(s.serviceCategories.salonId, salon.id), with: { services: true } }),
    db.query.staff.findMany({ where: eq(s.staff.salonId, salon.id), columns: { title: true, titleKy: true } }),
  ]);
  const map: Record<string, string> = {};
  for (const c of cats) {
    if (c.nameKy) map[c.name] = c.nameKy;
    for (const v of c.services) if (v.nameKy) map[v.name] = v.nameKy;
  }
  for (const m of staff) if (m.title && m.titleKy) map[m.title] = m.titleKy;
  return map;
});

/** Перевод для серверной страницы; slug — чтобы учесть названия из настроек салона */
export async function getT(slug?: string) {
  const lang = await getLang();
  const extra = lang === 'ky' && slug ? await salonKy(slug) : undefined;
  return { lang, t: makeT(lang, extra) };
}
