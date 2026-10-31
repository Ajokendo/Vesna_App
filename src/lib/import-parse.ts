import type { HairLength } from '@/db/schema';
import { addDays, type DateStr } from './time';

/** Строка списка для переноса из бумажного журнала */
export type ImportRow = {
  line: number; date: DateStr; minute: number; staff: string; service: string;
  client: string; phone: string; length: HairLength | null;
};

export const norm = (x: string) => x.toLowerCase().replace(/ё/g, 'е').replace(/[«»"']/g, '').replace(/\s+/g, ' ').trim();

const LENGTHS: [RegExp, HairLength][] = [[/^оч|^xl|^extra/, 'XLONG'], [/^кор/, 'SHORT'], [/^сред/, 'MEDIUM'], [/^дл/, 'LONG']];

/** «12.11», «12.11.2026», «2026-11-12» → дата; без года — ближайшая будущая */
export function parseDate(x: string, today: DateStr): DateStr | null {
  let y: number, m: number, d: number;
  const iso = x.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const ru = x.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (iso) [y, m, d] = [+iso[1], +iso[2], +iso[3]];
  else if (ru) {
    [d, m] = [+ru[1], +ru[2]];
    y = ru[3] ? (ru[3].length === 2 ? 2000 + +ru[3] : +ru[3]) : +today.slice(0, 4);
    if (!ru[3]) { const c = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; if (c < addDays(today, -31)) y++; }
  } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** «14:00», «14.00», «9:30», «1400», «14» → минуты от полуночи */
export function parseTime(x: string): number | null {
  const t = x.match(/^(\d{1,2})(?:[:.\-]?(\d{2}))?$/);
  if (!t) return null;
  const h = +t[1], mi = t[2] ? +t[2] : 0;
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

/**
 * Разбор вставленного списка. Одна запись — одна строка, поля через «;», табуляцию или «|»:
 * дата; время; мастер; услуга; клиент; телефон; длина волос (необязательно)
 */
export function parseImport(text: string, today: DateStr): { rows: ImportRow[]; errors: { line: number; text: string; error: string }[] } {
  const rows: ImportRow[] = [], errors: { line: number; text: string; error: string }[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1, src = raw.trim();
    if (!src || src.startsWith('#') || /^дата\s*[;|\t]/i.test(src)) return;
    const f = src.split(/\t|;|\|/).map((x) => x.trim());
    const fail = (error: string) => errors.push({ line, text: src, error });
    if (f.length < 5) return fail('Не хватает полей: нужно дата; время; мастер; услуга; клиент; телефон');
    const date = parseDate(f[0], today);
    if (!date) return fail(`Не понял дату «${f[0]}» (пример: 12.11)`);
    if (date < today) return fail('Дата уже прошла');
    const minute = parseTime(f[1]);
    if (minute == null) return fail(`Не понял время «${f[1]}» (пример: 14:00)`);
    if (!f[2]) return fail('Не указан мастер');
    if (!f[3]) return fail('Не указана услуга');
    if (!f[4]) return fail('Не указано имя клиента');
    const phone = (f[5] ?? '').replace(/[^\d+]/g, '');
    if (phone && phone.replace(/\D/g, '').length < 9) return fail(`Телефон «${f[5]}» слишком короткий`);
    const lt = norm(f[6] ?? '');
    const length = lt ? LENGTHS.find(([re]) => re.test(lt))?.[1] ?? null : null;
    if (lt && !length) return fail(`Длина волос «${f[6]}»: напишите короткие / средние / длинные / очень длинные`);
    rows.push({ line, date, minute, staff: f[2], service: f[3], client: f[4], phone: normPhone(phone), length });
  });
  return { rows, errors };
}

/** 0555 12 34 56 → +996555123456 */
export function normPhone(p: string): string {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.length === 9) return `+996${d}`;
  if (d.length === 10 && d.startsWith('0')) return `+996${d.slice(1)}`;
  if (d.length === 12 && d.startsWith('996')) return `+${d}`;
  return p.startsWith('+') ? `+${d}` : d;
}
