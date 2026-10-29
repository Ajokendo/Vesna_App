import { KY } from './ky';

// Язык клиентской части: русский (по умолчанию) или кыргызский. Ключ перевода — сам русский текст:
// чего нет в словаре, остаётся по-русски. {name} в тексте — подстановка.
export type Lang = 'ru' | 'ky';
export type T = (s: string, vars?: Record<string, string | number>) => string;

export function makeT(lang: Lang): T {
  return (s, vars) => {
    let r = lang === 'ky' ? (KY[s] ?? s) : s;
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
