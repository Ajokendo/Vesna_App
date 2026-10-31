import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { busyParts, fits, masterDuration } from '@/lib/slots';
import { hhmm, utcToZoned, dayMonthShort, type DateStr } from '@/lib/time';
import { norm, parseImport, type ImportRow } from '@/lib/import-parse';
import { bookingDuration, createAppointment, eligibleStaffIds, getSalon, staffDay } from './salon';

export type ImportCheck = {
  line: number; ok: boolean; error?: string; warn?: string;
  date?: string; time?: string; staff?: string; service?: string; client?: string; phone?: string;
};

type Resolved = ImportRow & { staffId: string; serviceId: string; staffName: string; serviceName: string };

/**
 * Перенос записей из бумажного журнала: разбор списка, проверка накладок (с журналом и внутри списка),
 * при commit — создание записей от имени администратора, без уведомлений клиентам.
 */
export async function importAppointments(slug: string, text: string, commit: boolean) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  const today = utcToZoned(new Date(), salon.timezone).date;
  const { rows, errors } = parseImport(text, today);
  const out: ImportCheck[] = errors.map((e) => ({ line: e.line, ok: false, error: e.error, client: e.text }));

  const [staff, cats] = await Promise.all([
    db.query.staff.findMany({ where: and(eq(s.staff.salonId, salon.id), eq(s.staff.active, true)) }),
    db.query.serviceCategories.findMany({ where: eq(s.serviceCategories.salonId, salon.id), with: { services: true } }),
  ]);
  const services = cats.flatMap((c) => c.services.filter((x) => x.active).map((x) => ({ ...x, full: norm(`${c.name} ${x.name}`), label: `${c.name} — ${x.name}` })));

  const findStaff = (q: string) => {
    const n = norm(q);
    const exact = staff.filter((m) => norm(m.name) === n);
    if (exact.length) return exact;
    return staff.filter((m) => norm(m.name).split(' ').some((w) => w.startsWith(n)) || norm(m.name).startsWith(n));
  };
  const findService = (q: string) => {
    const n = norm(q);
    const exact = services.filter((x) => norm(x.name) === n || x.full === n);
    if (exact.length) return exact;
    const words = n.split(' ');
    return services.filter((x) => words.every((w) => x.full.includes(w)));
  };

  const resolved: Resolved[] = [];
  for (const r of rows) {
    const base = { line: r.line, date: dayMonthShort(r.date), time: hhmm(r.minute), client: r.client, phone: r.phone };
    const ms = findStaff(r.staff);
    if (ms.length !== 1) { out.push({ ...base, ok: false, staff: r.staff, service: r.service, error: ms.length ? `Мастер «${r.staff}»: подходит несколько — ${ms.map((m) => m.name).join(', ')}` : `Мастер «${r.staff}» не найден` }); continue; }
    const sv = findService(r.service);
    if (sv.length !== 1) { out.push({ ...base, ok: false, staff: ms[0].name, service: r.service, error: sv.length ? `Услуга «${r.service}»: уточните — ${sv.slice(0, 4).map((x) => x.label).join(' / ')}` : `Услуга «${r.service}» не найдена (названия — как в «Услугах»)` }); continue; }
    resolved.push({ ...r, staffId: ms[0].id, staffName: ms[0].name, serviceId: sv[0].id, serviceName: sv[0].name });
  }

  // Проверка по дням: занятость мастера из журнала + уже принятые строки списка
  const days = new Map<string, Awaited<ReturnType<typeof staffDay>>[number]>();
  const okRows: Resolved[] = [];
  for (const r of resolved.sort((a, b) => a.date.localeCompare(b.date) || a.minute - b.minute)) {
    const base: ImportCheck = { line: r.line, ok: false, date: dayMonthShort(r.date), time: hhmm(r.minute), staff: r.staffName, service: r.serviceName, client: r.client, phone: r.phone };
    let length = r.length, warn: string | undefined;
    try {
      let dur;
      try { dur = await bookingDuration({ serviceId: r.serviceId, length, addonIds: [] }); }
      catch (e) {
        if (length) throw e;
        length = 'MEDIUM'; warn = 'Длина волос не указана — поставили «средние»';
        dur = await bookingDuration({ serviceId: r.serviceId, length, addonIds: [] });
      }
      if (!eligibleStaffIds(dur.svc).includes(r.staffId)) throw new Error(`${r.staffName} не делает эту услугу (см. «Мастера»)`);
      const key = `${r.staffId}|${r.date}`;
      if (!days.has(key)) days.set(key, (await staffDay([r.staffId], r.date as DateStr, salon.timezone))[0]);
      const m = days.get(key)!;
      const len = masterDuration(dur.durationMin, m.tempo);
      const pause = dur.resolved.pause;
      if (!fits({ start: 0, end: 24 * 60, breaks: [] }, m.busy, r.minute, len, pause)) {
        throw new Error(`Накладка: у ${r.staffName} в это время уже есть запись (${hhmm(r.minute)}–${hhmm(r.minute + len)}) — возможно, эта строка уже перенесена`);
      }
      if (!m.day) warn = [warn, `У ${r.staffName} в этот день выходной по графику`].filter(Boolean).join('. ');
      else if (r.minute < m.day.start || r.minute + len > m.day.end) warn = [warn, 'Вне рабочих часов мастера'].filter(Boolean).join('. ');
      m.busy.push(...busyParts(r.minute, r.minute + len + m.buffer, pause));
      out.push({ ...base, ok: true, warn, time: `${hhmm(r.minute)}–${hhmm(r.minute + len)}` });
      okRows.push({ ...r, length });
    } catch (e) {
      out.push({ ...base, error: (e as Error).message });
    }
  }

  let created = 0;
  if (commit) {
    for (const r of okRows) {
      try {
        await createAppointment(slug, {
          serviceId: r.serviceId, staffId: r.staffId, length: r.length, addonIds: [], date: r.date, minute: r.minute,
          client: { name: r.client, phone: r.phone }, source: 'ADMIN', silent: true,
        });
        created++;
      } catch (e) {
        const row = out.find((x) => x.line === r.line);
        if (row) { row.ok = false; row.error = (e as Error).message; }
      }
    }
  }
  out.sort((a, b) => a.line - b.line);
  return { rows: out, ok: out.filter((x) => x.ok).length, failed: out.filter((x) => !x.ok).length, created };
}
