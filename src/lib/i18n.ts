import { KY } from './ky';

// Язык клиентской части: русский (по умолчанию) или кыргызский. Ключ перевода — сам русский текст:
// чего нет в словаре, остаётся по-русски. {name} в тексте — подстановка.
export type Lang = 'ru' | 'ky';
export type T = (s: string, vars?: Record<string, string | number>) => string;

/** extra — переводы салона из настроек («Название по-кыргызски»): важнее общего словаря */
export function makeT(lang: Lang, extra?: Record<string, string>): T {
  return (s, vars) => {
    let r = lang === 'ky' ? (extra?.[s] ?? KY[s] ?? s) : s;
    if (vars) for (const [k, v] of Object.entries(vars)) r = r.split(`{${k}}`).join(String(v));
    return r;
  };
}

/** Язык из cookie «lang» или из языка телефона (Accept-Language) */
export function pickLang(cookie: string | undefined, acceptLanguage: string | null | undefined): Lang {
  if (cookie === 'ky' || cookie === 'ru') return cookie;
  const first = (acceptLanguage ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('ky') ? 'ky' : 'ru';
}

const KY_DAYS: Record<string, string> = { пн: 'дш', вт: 'шш', ср: 'шр', чт: 'бш', пт: 'жм', сб: 'иш', вс: 'жк' };

/** Подпись графика мастера по-кыргызски: «Рабочие дни: пн, ср · 09:30–19:00» → «Иш күндөрү: дш, шр · 09:30–19:00» */
export function scheduleIn(lang: Lang, label: string) {
  if (lang !== 'ky' || !label) return label;
  return label
    .replace(/^Работает (\d+) через (\d+)/, '$1 күн иштейт, $2 күн эс алат')
    .replace('Рабочие дни: ', 'Иш күндөрү: ')
    .replace('каждый день', 'күн сайын')
    .replace('График уточняется', 'График такталууда')
    .replace(/(^|[\s,:–])(пн|вт|ср|чт|пт|сб|вс)(?=$|[\s,·–])/g, (_, p, d) => p + KY_DAYS[d]);
}

/** Длительность из прайса по-кыргызски: «20–30 мин» → «20–30 мүн», «1,5–2 ч» → «1,5–2 саат» */
export function durationIn(lang: Lang, label: string) {
  if (lang !== 'ky' || !label) return label;
  return label.replace(/\bмин\b|мин(?=\.|$|\s)/g, 'мүн').replace(/(\d)\s*ч\b|(\d)\s*ч(?=$|\s|\.)/g, (m, a, b) => `${a ?? b} саат`);
}
