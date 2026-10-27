// Свободные окна для записи.
// Время не привязано к жёсткой сетке 30 минут: проверка идёт с точностью до шага салона (5 минут),
// а клиенту предлагаются окна по удобной сетке (15 минут) плюс окна сразу после каждой записи,
// чтобы короткие услуги шли подряд (две стрижки по 15 минут за полчаса).

import type { Interval, WorkingDay } from './schedule';
import type { Pause } from './pricing';

export type SlotQuery = {
  day: WorkingDay;
  durationMin: number;
  /** Выдержка внутри услуги: в это время у мастера можно занять другое окно */
  pause?: Pause | null;
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

/** Когда мастер реально занят записью: вся запись минус выдержка */
export function busyParts(start: number, end: number, pause?: Pause | null): Interval[] {
  if (!pause || start + pause.after + pause.min >= end) return [{ start, end }];
  return [{ start, end: start + pause.after }, { start: start + pause.after + pause.min, end }];
}

export function fits(day: WorkingDay, busy: Interval[], start: number, durationMin: number, pause?: Pause | null): boolean {
  if (start < day.start || start + durationMin > day.end) return false;
  const blocked = [...day.breaks, ...busy];
  return !busyParts(start, start + durationMin, pause).some((part) => blocked.some((b) => overlaps(part, b)));
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
  for (const b of blocked) {
    candidates.add(ceilTo(b.end, step));
    // услугу с выдержкой можно начать так, чтобы чужая запись пришлась на выдержку
    if (q.pause) candidates.add(ceilTo(b.start - q.pause.after, step));
  }
  if (Number.isFinite(earliest)) candidates.add(ceilTo(earliest, step));

  return [...candidates]
    .filter((t) => t >= earliest && fits(q.day, q.busy, t, dur, q.pause))
    .sort((a, b) => a - b);
}

/** Время услуги у конкретного мастера: с учётом его темпа, округлено вверх до 5 минут */
export function masterDuration(durationMin: number, tempo = 100) {
  return tempo === 100 ? durationMin : Math.ceil((durationMin * tempo) / 100 / 5) * 5;
}
