import { describe, expect, it } from 'vitest';
import { addDays, hhmm, weekdayMon0, zonedToUtc, utcToZoned } from './time';
import { isWorkingDay, scheduleLabel, workingHours, type ScheduleLike } from './schedule';
import { availableStarts, busyParts } from './slots';
import { calcPayment } from './payment';
import { ageOn, pickByAge, quote, resolveService, formatPrice, type ServiceLike } from './pricing';

const weekly = (weekdays: number[], start = 570, end = 1140, br?: [number, number]): ScheduleLike => ({
  kind: 'WEEKLY', weekdays, cycleWork: null, cycleOff: null, cycleStart: null,
  startMinute: start, endMinute: end, breakStart: br?.[0] ?? null, breakEnd: br?.[1] ?? null,
});
const cycle = (work: number, off: number, start: string): ScheduleLike => ({
  kind: 'CYCLE', weekdays: [], cycleWork: work, cycleOff: off, cycleStart: start,
  startMinute: 570, endMinute: 1200, breakStart: null, breakEnd: null,
});

describe('время салона (Бишкек, UTC+6)', () => {
  it('переводит минуты дня в UTC и обратно', () => {
    const at = zonedToUtc('2026-10-31', 15 * 60, 'Asia/Bishkek');
    expect(at.toISOString()).toBe('2026-10-31T09:00:00.000Z');
    expect(utcToZoned(at, 'Asia/Bishkek')).toEqual({ date: '2026-10-31', minute: 900 });
  });
  it('считает день недели с понедельника', () => {
    expect(weekdayMon0('2026-10-26')).toBe(0); // понедельник
    expect(weekdayMon0('2026-11-01')).toBe(6); // воскресенье
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
});

describe('графики мастеров', () => {
  it('Анастасия: ср, чт, сб, вс', () => {
    const s = weekly([2, 3, 5, 6]);
    expect(isWorkingDay(s, '2026-10-27')).toBe(false); // вторник
    expect(isWorkingDay(s, '2026-10-28')).toBe(true); // среда
    expect(isWorkingDay(s, '2026-10-31')).toBe(true); // суббота
  });
  it('скользящий график 6 через 1', () => {
    const s = cycle(6, 1, '2026-10-26');
    const days = Array.from({ length: 14 }, (_, i) => isWorkingDay(s, addDays('2026-10-26', i)));
    expect(days).toEqual([true, true, true, true, true, true, false, true, true, true, true, true, true, false]);
    expect(isWorkingDay(s, '2026-10-25')).toBe(false); // за день до начала отсчёта — выходной цикла
  });
  it('исключение: выходной или другие часы на один день', () => {
    const s = weekly([0, 1, 2, 3, 4], 540, 900);
    expect(workingHours(s, [{ date: '2026-10-27', dayOff: true, startMinute: null, endMinute: null }], '2026-10-27')).toBeNull();
    expect(workingHours(s, [{ date: '2026-11-01', dayOff: false, startMinute: 600, endMinute: 780 }], '2026-11-01'))
      .toEqual({ start: 600, end: 780, breaks: [] });
  });
  it('подпись графика', () => {
    expect(scheduleLabel(weekly([2, 3, 5, 6]))).toBe('Ср, чт, сб, вс · 09:30–19:00');
    expect(scheduleLabel(weekly([0, 1, 2, 3, 4], 540, 900))).toBe('Пн–пт · 09:00–15:00');
    expect(scheduleLabel(cycle(6, 1, '2026-10-26'))).toBe('6 через 1 · 09:30–20:00');
  });
});

describe('свободное время', () => {
  const day = { start: 570, end: 1140, breaks: [{ start: 780, end: 840 }] };

  it('не пересекает обед и записи, укладывается в рабочий день', () => {
    const starts = availableStarts({ day, durationMin: 30, busy: [{ start: 600, end: 630 }] });
    expect(starts).not.toContain(600);
    expect(starts).not.toContain(765); // 12:45–13:15 задевает обед
    expect(starts).toContain(750); // 12:30–13:00 — вплотную к обеду
    expect(starts).toContain(840); // сразу после обеда
    expect(starts[starts.length - 1]).toBe(1110); // последняя запись 18:30–19:00
  });

  it('две короткие стрижки подряд за полчаса: окно сразу после предыдущей записи', () => {
    // Окантовка 15 минут в 10:00–10:15 → следующее окно 10:15, а не 10:30
    const starts = availableStarts({ day, durationMin: 15, busy: [{ start: 600, end: 615 }] });
    expect(starts).toContain(615);
  });

  it('окно после записи с «неровным» концом округляется до шага 5 минут', () => {
    const starts = availableStarts({ day, durationMin: 20, busy: [{ start: 600, end: 622 }] });
    expect(starts).toContain(625);
    expect(starts).not.toContain(622);
  });

  it('не раньше чем за минимальное время до записи', () => {
    const starts = availableStarts({ day, durationMin: 30, busy: [], earliestMin: 11 * 60 + 2 });
    expect(Math.min(...starts)).toBe(11 * 60 + 5);
    expect(hhmm(starts[0])).toBe('11:05');
  });

  it('длинная услуга не влезает в короткий день', () => {
    expect(availableStarts({ day: { start: 540, end: 900, breaks: [] }, durationMin: 400, busy: [] })).toEqual([]);
  });
});

const svc = (over: Partial<ServiceLike>): ServiceLike => ({
  id: 's', name: 'x', price: null, priceMax: null, durationMin: null, durationLabel: null, byLength: null, ageMin: null, ageMax: null, ...over,
});

describe('цены', () => {
  it('цена по длине волос', () => {
    const cascade = svc({ byLength: { MEDIUM: { price: 800, dur: 60 }, LONG: { price: 900, dur: 60 }, XLONG: { price: 1100, dur: 70 } } });
    expect(resolveService(cascade, 'LONG')?.price).toBe(900);
    expect(resolveService(cascade, 'SHORT')).toBeNull(); // каскад на короткие не делают
  });

  it('тотал блонд «от–до»: баллы заранее не списываются', () => {
    const blond = resolveService(svc({ byLength: { MEDIUM: { price: 1500, max: 2500, dur: 150 } } }), 'MEDIUM')!;
    const q = quote({ service: blond, addons: [], pointsBalance: 640, usePoints: true });
    expect(q.isRange).toBe(true);
    expect(q.pointsUsed).toBe(0);
    expect(formatPrice(q.total, q.totalMax)).toBe('1 500–2 500 сом');
  });

  it('снятие покрытия бесплатно при повторном маникюре', () => {
    const mani = resolveService(svc({ price: 1000, durationMin: 90 }))!;
    const removal = { id: 'r', name: 'Снятие покрытия', price: 200, durationMin: 20, rule: 'FREE_IF_REPEAT' as const };
    expect(quote({ service: mani, addons: [removal], repeatEligible: true }).total).toBe(1000);
    expect(quote({ service: mani, addons: [removal], repeatEligible: false }).total).toBe(1200);
    expect(quote({ service: mani, addons: [removal] }).durationMin).toBe(110);
  });

  it('баллы покрывают услугу целиком или частично', () => {
    const cut = resolveService(svc({ price: 500, durationMin: 30 }))!;
    expect(quote({ service: cut, addons: [], pointsBalance: 640, usePoints: true })).toMatchObject({ pointsUsed: 500, total: 0 });
    expect(quote({ service: cut, addons: [], pointsBalance: 200, usePoints: true })).toMatchObject({ pointsUsed: 200, total: 300 });
  });

  it('детская стрижка по возрасту', () => {
    const tiers = [
      { ageMin: 1, ageMax: 6, price: 300 }, { ageMin: 7, ageMax: 10, price: 350 }, { ageMin: 11, ageMax: 14, price: 400 },
    ];
    expect(ageOn('2018-03-15', '2026-10-31')).toBe(8);
    expect(pickByAge(tiers, ageOn('2018-03-15', '2026-10-31'))?.price).toBe(350);
    expect(pickByAge(tiers, 15)).toBeUndefined();
  });
});

describe('выдержка краски: мастер свободен, пока краска впитывается', () => {
  const day = { start: 540, end: 1200, breaks: [] };
  const pause = { after: 30, min: 35 }; // нанесение 30 мин, выдержка 35, затем смывка и укладка
  it('во время выдержки окрашивания можно записать стрижку', () => {
    // окрашивание 10:00–11:45, выдержка 10:30–11:05
    const busy = busyParts(600, 705, pause);
    expect(busy).toEqual([{ start: 600, end: 630 }, { start: 665, end: 705 }]);
    const starts = availableStarts({ day, durationMin: 30, busy, earliestMin: 600 });
    expect(starts).toContain(630);      // 10:30 — сразу после нанесения
    expect(starts).not.toContain(640);  // 10:40–11:10 залезает на смывку
  });
  it('окрашивание можно начать так, чтобы чужая стрижка пришлась на выдержку', () => {
    const busy = [{ start: 660, end: 690 }]; // стрижка 11:00–11:30
    const starts = availableStarts({ day, durationMin: 105, pause, busy, earliestMin: 600 });
    expect(starts).toContain(630); // 10:30: нанесение до 11:00, выдержка 11:00–11:35
    expect(availableStarts({ day, durationMin: 105, busy, earliestMin: 600 })).not.toContain(630); // без выдержки — нельзя
  });
  it('выдержка берётся из прайса по длине волос', () => {
    const s: ServiceLike = { id: 'c', name: 'В один тон', price: null, priceMax: null, durationMin: null, durationLabel: null, ageMin: null, ageMax: null,
      byLength: { SHORT: { price: 600, dur: 105, pa: 30, pm: 35 } } };
    expect(resolveService(s, 'SHORT')?.pause).toEqual({ after: 30, min: 35 });
  });
});

describe('оплата баллами и доля мастера', () => {
  const base = { earnPercent: 5, masterPercent: 50 };
  it('без баллов: 5% баллами, мастеру половина', () => {
    expect(calcPayment({ ...base, price: 600, points: 0, balance: 0 })).toMatchObject({ cash: 600, pointsEarned: 30, masterShare: 300, salonShare: 300 });
  });
  it('часть баллами: из 140 списали 100, услуга 600 → баллы с 500, делят 500', () => {
    expect(calcPayment({ ...base, price: 600, points: 100, balance: 140 }))
      .toEqual({ price: 600, pointsUsed: 100, cash: 500, pointsEarned: 25, balanceAfter: 65, masterPercent: 50, masterShare: 250, salonShare: 250 });
  });
  it('целиком баллами: ни мастеру, ни салону, баллы не начисляются', () => {
    expect(calcPayment({ ...base, price: 500, points: 500, balance: 520 })).toMatchObject({ cash: 0, pointsEarned: 0, masterShare: 0, salonShare: 0, balanceAfter: 20 });
  });
  it('200 баллов из 500 → делят 300', () => {
    expect(calcPayment({ ...base, price: 500, points: 200, balance: 200 })).toMatchObject({ cash: 300, masterShare: 150, salonShare: 150 });
  });
  it('хозяйка-мастер: комиссии нет, всё салону', () => {
    expect(calcPayment({ ...base, masterPercent: 0, price: 800, points: 0, balance: 0 })).toMatchObject({ masterShare: 0, salonShare: 800 });
  });
  it('нельзя списать больше, чем есть или чем стоит услуга', () => {
    expect(() => calcPayment({ ...base, price: 600, points: 150, balance: 140 })).toThrow('140');
    expect(() => calcPayment({ ...base, price: 300, points: 400, balance: 500 })).toThrow();
  });
});
