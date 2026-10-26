// Расчёт цены и длительности записи: цена по длине волос, «от–до», детская цена по возрасту,
// доп. опции (в том числе «снятие бесплатно при повторном маникюре») и оплата баллами.

import type { ByLength, HairLength } from '@/db/schema';

export type ServiceLike = {
  id: string;
  name: string;
  price: number | null;
  priceMax: number | null;
  durationMin: number | null;
  durationLabel: string | null;
  byLength: ByLength | null;
  ageMin: number | null;
  ageMax: number | null;
  pauseAfterMin?: number | null;
  pauseMin?: number | null;
};

/** Выдержка внутри услуги: с минуты after от начала, длительностью min; мастер в это время свободен */
export type Pause = { after: number; min: number };

export type AddonLike = { id: string; name: string; price: number; durationMin: number; rule: 'FREE_IF_REPEAT' | null };

export type ResolvedService = { price: number; priceMax: number | null; durationMin: number; durationLabel: string | null; pause: Pause | null };

function pauseOf(after: number | null | undefined, min: number | null | undefined, dur: number): Pause | null {
  if (!after || !min || after + min >= dur) return null;
  return { after, min };
}

export function resolveService(s: ServiceLike, length?: HairLength | null): ResolvedService | null {
  if (s.byLength) {
    if (!length) return null;
    const v = s.byLength[length];
    if (!v) return null;
    return { price: v.price, priceMax: v.max ?? null, durationMin: v.dur, durationLabel: v.label ?? null, pause: pauseOf(v.pa, v.pm, v.dur) };
  }
  if (s.price == null || s.durationMin == null) return null;
  return { price: s.price, priceMax: s.priceMax, durationMin: s.durationMin, durationLabel: s.durationLabel, pause: pauseOf(s.pauseAfterMin, s.pauseMin, s.durationMin) };
}

/** Детская услуга, подходящая по возрасту */
export function pickByAge<T extends { ageMin: number | null; ageMax: number | null }>(list: T[], age: number): T | undefined {
  return list.find((s) => s.ageMin != null && s.ageMax != null && age >= s.ageMin && age <= s.ageMax);
}

export function ageOn(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = onDate.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export type Quote = {
  base: number;
  baseMax: number | null;
  addons: { id: string; name: string; price: number; free: boolean }[];
  pointsUsed: number;
  total: number;
  totalMax: number | null;
  isRange: boolean;
  durationMin: number;
  /** Сколько баллов начислится после визита */
  earn: number;
};

export function quote(params: {
  service: ResolvedService;
  addons: AddonLike[];
  /** Выполнено ли условие FREE_IF_REPEAT (прошлая услуга этой категории была в салоне) */
  repeatEligible?: boolean;
  pointsBalance?: number;
  usePoints?: boolean;
  /** Процент от чека, который возвращается баллами */
  earnPercent?: number;
}): Quote {
  const { service } = params;
  const addons = params.addons.map((a) => {
    const free = a.rule === 'FREE_IF_REPEAT' && !!params.repeatEligible;
    return { id: a.id, name: a.name, price: free ? 0 : a.price, free };
  });
  const addonSum = addons.reduce((s, a) => s + a.price, 0);
  const isRange = service.priceMax != null && service.priceMax > service.price;
  const before = service.price + addonSum;
  // «От–до» оплачивается в салоне после консультации — баллами заранее не списываем
  const pointsUsed = params.usePoints && !isRange ? Math.min(params.pointsBalance ?? 0, before) : 0;
  const total = before - pointsUsed;
  const durationMin = service.durationMin + params.addons.reduce((s, a) => s + a.durationMin, 0);
  return {
    base: service.price,
    baseMax: isRange ? service.priceMax : null,
    addons,
    pointsUsed,
    total,
    totalMax: isRange ? (service.priceMax as number) + addonSum : null,
    isRange,
    durationMin,
    earn: Math.round(total * (params.earnPercent ?? 5) / 100),
  };
}

export function formatSom(n: number): string {
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} сом`;
}

export function formatPrice(price: number, max?: number | null): string {
  if (max != null && max > price) return `${String(price).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}–${formatSom(max)}`;
  return formatSom(price);
}
