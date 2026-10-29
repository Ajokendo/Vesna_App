// Работа с датами в часовом поясе салона.
// Даты дня храним строкой 'YYYY-MM-DD', время — минутами от полуночи по времени салона.

export type DateStr = string;

function partsIn(tz: string, d: Date) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Смещение часового пояса относительно UTC в минутах на заданный момент */
export function tzOffsetMinutes(tz: string, at: Date): number {
  const p = partsIn(tz, at);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** День и минута по времени салона → момент в UTC */
export function zonedToUtc(date: DateStr, minute: number, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minute);
  let off = tzOffsetMinutes(tz, new Date(guess));
  let res = guess - off * 60000;
  const off2 = tzOffsetMinutes(tz, new Date(res));
  if (off2 !== off) { off = off2; res = guess - off * 60000; }
  return new Date(res);
}

/** Момент в UTC → день и минута по времени салона */
export function utcToZoned(at: Date, tz: string): { date: DateStr; minute: number } {
  const p = partsIn(tz, at);
  return { date: `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`, minute: p.h * 60 + p.mi };
}

export function addDays(date: DateStr, n: number): DateStr {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function daysBetween(from: DateStr, to: DateStr): number {
  const a = Date.parse(from + 'T00:00:00Z');
  const b = Date.parse(to + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

/** 0 = понедельник … 6 = воскресенье */
export function weekdayMon0(date: DateStr): number {
  const js = new Date(date + 'T00:00:00Z').getUTCDay();
  return (js + 6) % 7;
}

export function hhmm(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const WD_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

// Кыргызча: «29-октябрь», «29-окт», дүйшөмбү…
const KY_WD = ['дш', 'шш', 'шр', 'бш', 'жм', 'иш', 'жк'];
const KY_WD_FULL = ['дүйшөмбү', 'шейшемби', 'шаршемби', 'бейшемби', 'жума', 'ишемби', 'жекшемби'];
const KY_MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const KY_MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
type DateLang = 'ru' | 'ky';

export function weekdayShort(date: DateStr, lang: DateLang = 'ru') { return (lang === 'ky' ? KY_WD : WD)[weekdayMon0(date)]; }
export function weekdayFull(date: DateStr, lang: DateLang = 'ru') { return (lang === 'ky' ? KY_WD_FULL : WD_FULL)[weekdayMon0(date)]; }
export function dayMonth(date: DateStr, lang: DateLang = 'ru') {
  const [, m, d] = date.split('-').map(Number);
  return lang === 'ky' ? `${d}-${KY_MONTHS[m - 1]}` : `${d} ${MONTHS_GEN[m - 1]}`;
}
export function dayMonthShort(date: DateStr, lang: DateLang = 'ru') {
  const [, m, d] = date.split('-').map(Number);
  return lang === 'ky' ? `${d}-${KY_MONTHS_SHORT[m - 1]}` : `${d} ${MONTHS_SHORT[m - 1]}`;
}
