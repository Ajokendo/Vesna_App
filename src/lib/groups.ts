// Разделы журнала: мастера и услуги делятся по направлению работы.

export const GROUPS = [
  { id: 'hair', name: 'Волосы' },
  { id: 'nails', name: 'Ногти' },
  { id: 'brows', name: 'Брови и шугаринг' },
] as const;
export type GroupId = (typeof GROUPS)[number]['id'];

/** К какому разделу относится раздел услуг (по названию) */
export function categoryGroup(name: string): GroupId {
  if (/стриж|окраш|уклад|причёс|причес|борода|детск|детям|волос/i.test(name)) return 'hair';
  if (/маник|педик|наращ|ногт/i.test(name)) return 'nails';
  return 'brows';
}
