// Свободные окна для записи.
// Время не привязано к жёсткой сетке 30 минут: проверка идёт с точностью до шага салона (5 минут),
// а клиенту предлагаются окна по удобной сетке (15 минут) плюс окна сразу после каждой записи,
// чтобы короткие услуги шли подряд (две стрижки по 15 минут за полчаса).

import type { Interval, WorkingDay } from './schedule';

export type SlotQuery = {
  day: WorkingDay;
  durationMin: number;
  busy: Interval[];
  stepMin?: number;
  displayStepMin?: number;
  /** Раньше этой минуты записаться нельзя (сейчас + минимальное время до записи) */
  earliestMin?: number;
};

const ceilTo = (v: number, step: number) => Math.ceil(v / step) * step;

export function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && a.end > b.start;
}

export function fits(day: WorkingDay, busy: Interval[], start: number, durationMin: number): boolean {
  const slot = { start, end: start + durationMin };
  if (slot.start < day.start || slot.end > day.end) return false;
  return ![...day.breaks, ...busy].some((b) => overlaps(slot, b));
}

export function availableStarts(q: SlotQuery): number[] {
  const step = q.stepMin ?? 5;
  const display = q.displayStepMin ?? 15;
  const dur = Math.max(step, ceilTo(q.durationMin, step));
  const earliest = q.earliestMin ?? -Infinity;
  const blocked = [...q.day.breaks, ...q.busy];

  const candidates = new Set<number>();
  for (let t = ceilTo(q.day.start, display); t + dur <= q.day.end; t += display) candidates.add(t);
  candidates.add(ceilTo(q.day.start, step));
  for (const b of blocked) candidates.add(ceilTo(b.end, step));
  if (Number.isFinite(earliest)) candidates.add(ceilTo(earliest, step));

  return [...candidates]
    .filter((t) => t >= earliest && fits(q.day, q.busy, t, dur))
    .sort((a, b) => a - b);
}
