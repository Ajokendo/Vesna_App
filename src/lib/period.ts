import { addDays, dayMonth, daysBetween, weekdayMon0, type DateStr } from './time';

// Период отчёта: день, неделя (пн–вс), месяц или год, содержащий дату `at`.
// to — не включительно. Для графика период делится на столбики: по дням (неделя, месяц) или по месяцам (год).

export type PeriodKind = 'day' | 'week' | 'month' | 'year';
export const PERIODS: { id: PeriodKind; name: string }[] = [
  { id: 'day', name: 'День' }, { id: 'week', name: 'Неделя' }, { id: 'month', name: 'Месяц' }, { id: 'year', name: 'Год' },
];

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export type Period = {
  kind: PeriodKind; at: DateStr; from: DateStr; to: DateStr; days: number;
  label: string; prev: DateStr; next: DateStr;
  /** Столбики графика: начало (вкл.), конец (не вкл.), подпись */
  buckets: { from: DateStr; to: DateStr; label: string }[];
};

const ym = (d: DateStr) => [Number(d.slice(0, 4)), Number(d.slice(5, 7))] as const;
const monthStart = (y: number, m: number): DateStr => `${y}-${String(m).padStart(2, '0')}-01`;
function addMonths(d: DateStr, n: number): DateStr {
  const [y, m] = ym(d);
  const t = y * 12 + (m - 1) + n;
  return monthStart(Math.floor(t / 12), (t % 12) + 1);
}

export function makePeriod(kind: PeriodKind, at: DateStr): Period {
  let from: DateStr; let to: DateStr; let label: string;
  const [y, m] = ym(at);
  if (kind === 'day') { from = at; to = addDays(at, 1); label = dayMonth(at); }
  else if (kind === 'week') {
    from = addDays(at, -weekdayMon0(at)); to = addDays(from, 7);
    label = `${dayMonth(from)} – ${dayMonth(addDays(to, -1))}`;
  } else if (kind === 'month') {
    from = monthStart(y, m); to = addMonths(from, 1);
    label = `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}`;
  } else { from = `${y}-01-01`; to = `${y + 1}-01-01`; label = `${y} год`; }

  const prev = kind === 'day' ? addDays(at, -1) : kind === 'week' ? addDays(from, -7) : kind === 'month' ? addMonths(from, -1) : `${y - 1}-01-01`;
  const next = kind === 'day' ? addDays(at, 1) : to;

  const buckets: Period['buckets'] = [];
  if (kind === 'year') {
    for (let i = 0; i < 12; i++) buckets.push({ from: monthStart(y, i + 1), to: addMonths(monthStart(y, i + 1), 1), label: MONTHS_SHORT[i] });
  } else if (kind !== 'day') {
    for (let d = from; d < to; d = addDays(d, 1)) buckets.push({ from: d, to: addDays(d, 1), label: String(Number(d.slice(8))) });
  }
  return { kind, at, from, to, days: daysBetween(from, to), label, prev, next, buckets };
}

/** Тот же по длине период непосредственно перед этим — для сравнения «было / стало» */
export function previousPeriod(p: Period): Period {
  return makePeriod(p.kind, p.prev);
}

/** Изменение в процентах (null — сравнивать не с чем) */
export function change(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}
