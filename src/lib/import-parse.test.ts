import { describe, expect, it } from 'vitest';
import { normPhone, parseDate, parseImport, parseTime } from './import-parse';

describe('перенос записей', () => {
  it('даты и время', () => {
    expect(parseDate('12.11', '2026-10-31')).toBe('2026-11-12');
    expect(parseDate('5.01', '2026-12-20')).toBe('2027-01-05');
    expect(parseDate('31.02', '2026-10-31')).toBeNull();
    expect(parseTime('14:30')).toBe(870);
    expect(parseTime('9.00')).toBe(540);
    expect(parseTime('25:00')).toBeNull();
  });
  it('телефоны', () => {
    expect(normPhone('0555 12 34 56')).toBe('+996555123456');
    expect(normPhone('+996 700 11-22-33')).toBe('+996700112233');
  });
  it('строки, заголовок, ошибки', () => {
    const r = parseImport('Дата; время; мастер\n12.11; 10:00; Жаннат; Стрижка; Айгуль; 0555123456\n12.11\t14:30\tРэйна\tОкрашивание\tМээрим\t\tдлинные\n01.10; 10:00; А; Б; В', '2026-10-31');
    expect(r.rows).toHaveLength(2);
    expect(r.rows[1]).toMatchObject({ line: 3, minute: 870, length: 'LONG', phone: '' });
    expect(r.errors).toHaveLength(1);
  });
});
