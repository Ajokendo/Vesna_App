// Разделы (вкладки) журнала: мастера и услуги делятся по направлению работы.

export const GROUPS = [
  { id: 'hair', name: 'Волосы' },
  { id: 'nails', name: 'Ногти' },
  { id: 'brows', name: 'Брови' },
  { id: 'sugar', name: 'Шугаринг' },
  { id: 'face', name: 'Косметология' },
] as const;
export type GroupId = (typeof GROUPS)[number]['id'];

/** К какому разделу журнала относится раздел услуг: как задано в настройках, иначе — по названию */
export function categoryGroup(nameOrCat: string | { name: string; journalGroup?: string | null }): GroupId {
  const cat = typeof nameOrCat === 'string' ? { name: nameOrCat, journalGroup: null } : nameOrCat;
  if (cat.journalGroup && GROUPS.some((g) => g.id === cat.journalGroup)) return cat.journalGroup as GroupId;
  const name = cat.name;
  if (/стриж|окраш|уклад|причёс|причес|борода|детск|детям|волос|барбер/i.test(name)) return 'hair';
  if (/маник|педик|наращ|ногт|гель/i.test(name)) return 'nails';
  if (/депил|шугар|воск|эпил/i.test(name)) return 'sugar';
  if (/космет|лиц|чистк|пилинг|массаж/i.test(name)) return 'face';
  return 'brows';
}
