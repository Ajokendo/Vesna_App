// Рабочие часы мастера на конкретный день: по дням недели или скользящим циклом (6/1, 5/2, 4/3),
// с учётом исключений (больничный, отпуск, другой график на один день).

import { daysBetween, weekdayMon0, type DateStr } from './time';

export type Interval = { start: number; end: number };

export type ScheduleLike = {
  kind: 'WEEKLY' | 'CYCLE';
  weekdays: number[];
  cycleWork: number | null;
  cycleOff: number | null;
  cycleStart: string | null;
  startMinute: number;
  endMinute: number;
  breakStart: number | null;
  breakEnd: number | null;
};

export type ExceptionLike = {
  date: string;
  dayOff: boolean;
  startMinute: number | null;
  endMinute: number | null;
};

export type WorkingDay = { start: number; end: number; breaks: Interval[] };

export function isWorkingDay(s: ScheduleLike, date: DateStr): boolean {
  if (s.kind === 'WEEKLY') return s.weekdays.includes(weekdayMon0(date));
  const work = s.cycleWork ?? 0;
  const off = s.cycleOff ?? 0;
  const len = work + off;
  if (!s.cycleStart || len <= 0 || work <= 0) return false;
  const d = daysBetween(s.cycleStart, date);
  return ((d % len) + len) % len < work;
}

export function workingHours(s: ScheduleLike | null | undefined, exceptions: ExceptionLike[], date: DateStr): WorkingDay | null {
  if (!s) return null;
  const ex = exceptions.find((e) => e.date === date);
  if (ex?.dayOff) return null;

  let start = s.startMinute;
  let end = s.endMinute;
  if (ex) {
    start = ex.startMinute ?? start;
    end = ex.endMinute ?? end;
  } else if (!isWorkingDay(s, date)) {
    return null;
  }
  if (end <= start) return null;

  const breaks: Interval[] = [];
  if (s.breakStart != null && s.breakEnd != null && s.breakEnd > s.breakStart) {
    const b = { start: Math.max(start, s.breakStart), end: Math.min(end, s.breakEnd) };
    if (b.end > b.start) breaks.push(b);
  }
  return { start, end, breaks };
}

/** Подпись графика для клиента: «Ср, чт, сб, вс · 09:30–19:00», «6 через 1 · 09:30–20:00» */
export function scheduleLabel(s: ScheduleLike | null | undefined): string {
  if (!s) return 'График уточняется';
  const t = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const hours = `${t(s.startMinute)}–${t(s.endMinute)}`;
  if (s.kind === 'CYCLE') return `${s.cycleWork} через ${s.cycleOff} · ${hours}`;
  const names = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  const days = [...s.weekdays].sort((a, b) => a - b);
  let label: string;
  if (days.length === 7) label = 'каждый день';
  else if (days.length > 2 && days.every((d, i) => i === 0 || d === days[i - 1] + 1)) label = `${names[days[0]]}–${names[days[days.length - 1]]}`;
  else label = days.map((d) => names[d]).join(', ');
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} · ${hours}`;
}
