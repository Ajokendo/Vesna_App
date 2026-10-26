import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema as s } from '@/db';
import { getSalon } from './salon';

// Настройки салона без разработчика: данные салона, правила записи и баллов, услуги и цены, мастера и графики.

async function salonOf(slug: string) {
  const salon = await getSalon(slug);
  if (!salon) throw new Error('Салон не найден');
  return salon;
}

export const SalonSettings = z.object({
  name: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(80).nullable(),
  city: z.string().trim().max(60).nullable(),
  address: z.string().trim().max(120).nullable(),
  phone: z.string().trim().max(30).nullable(),
  whatsapp: z.string().trim().max(30).nullable(),
  instagram: z.string().trim().max(60).nullable(),
  bookingHorizonDays: z.number().int().min(1).max(120),
  minLeadMinutes: z.number().int().min(0).max(24 * 60),
  pointsPercent: z.number().int().min(0).max(50),
  welcomeBonus: z.number().int().min(0).max(5000),
  minRedeem: z.number().int().min(0).max(100000),
  defaultCommission: z.number().int().min(0).max(100),
  lateCallMinutes: z.number().int().min(1).max(60),
  noShowMinutes: z.number().int().min(5).max(120),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  hoursText: z.string().trim().max(120).nullable(),
  mapUrl: z.string().trim().url().max(300).nullable(),
  menHallNote: z.string().trim().max(80).nullable(),
  womenHallNote: z.string().trim().max(80).nullable(),
  /** undefined — не менять; null — убрать; строка — новый логотип (квадрат PNG, уменьшен на телефоне) */
  logo: z.string().startsWith('data:image/').max(700_000).nullable().optional(),
});

export async function updateSalonSettings(slug: string, data: z.infer<typeof SalonSettings>) {
  const salon = await salonOf(slug);
  if (data.noShowMinutes <= data.lateCallMinutes) throw new Error('«Не пришёл» должно быть позже, чем «позвонить»');
  const { logo, ...rest } = data;
  const logoPatch = logo === undefined ? {}
    : logo ? { logoData: logo, logoUrl: `/api/${slug}/logo?v=${Date.now().toString(36)}` }
      : { logoData: null, logoUrl: null };
  await db.update(s.salons).set({ ...rest, ...logoPatch }).where(eq(s.salons.id, salon.id));
}

// ——— услуги ———

const LengthPrice = z.object({
  price: z.number().int().min(0), max: z.number().int().min(0).nullable().optional(), dur: z.number().int().min(5).max(600),
  label: z.string().max(30).nullable().optional(), pa: z.number().int().min(0).nullable().optional(), pm: z.number().int().min(0).nullable().optional(),
});

export const ServiceInput = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  price: z.number().int().min(0).nullable(),
  priceMax: z.number().int().min(0).nullable(),
  durationMin: z.number().int().min(5).max(600).nullable(),
  durationLabel: z.string().trim().max(30).nullable(),
  pauseAfterMin: z.number().int().min(0).max(600).nullable(),
  pauseMin: z.number().int().min(0).max(240).nullable(),
  byLength: z.object({ SHORT: LengthPrice.optional(), MEDIUM: LengthPrice.optional(), LONG: LengthPrice.optional(), XLONG: LengthPrice.optional() }).nullable(),
  ageMin: z.number().int().min(0).max(18).nullable(),
  ageMax: z.number().int().min(0).max(18).nullable(),
  active: z.boolean(),
});

export async function saveService(slug: string, input: z.infer<typeof ServiceInput>) {
  const salon = await salonOf(slug);
  const cat = await db.query.serviceCategories.findFirst({ where: and(eq(s.serviceCategories.id, input.categoryId), eq(s.serviceCategories.salonId, salon.id)) });
  if (!cat) throw new Error('Раздел не найден');
  if (cat.byLength) {
    if (!input.byLength || !Object.values(input.byLength).some(Boolean)) throw new Error('Укажите цену хотя бы для одной длины волос');
  } else if (input.price == null || input.durationMin == null) throw new Error('Укажите цену и длительность');
  if (input.priceMax != null && input.price != null && input.priceMax <= input.price) throw new Error('Цена «до» должна быть больше цены «от»');
  if (input.pauseAfterMin && input.pauseMin && input.durationMin && input.pauseAfterMin + input.pauseMin >= input.durationMin) {
    throw new Error('Выдержка должна заканчиваться раньше, чем вся услуга');
  }
  const values = {
    categoryId: cat.id, name: input.name, price: cat.byLength ? null : input.price, priceMax: cat.byLength ? null : input.priceMax,
    durationMin: cat.byLength ? null : input.durationMin, durationLabel: input.durationLabel || null,
    pauseAfterMin: input.pauseAfterMin || null, pauseMin: input.pauseMin || null,
    byLength: cat.byLength ? input.byLength : null, ageMin: input.ageMin, ageMax: input.ageMax, active: input.active,
  };
  if (input.id) {
    const svc = await db.query.services.findFirst({ where: eq(s.services.id, input.id), with: { category: true } });
    if (!svc || svc.category.salonId !== salon.id) throw new Error('Услуга не найдена');
    await db.update(s.services).set(values).where(eq(s.services.id, svc.id));
    return { id: svc.id };
  }
  const last = await db.query.services.findMany({ where: eq(s.services.categoryId, cat.id), orderBy: asc(s.services.sortOrder) });
  const [row] = await db.insert(s.services).values({ ...values, sortOrder: (last.at(-1)?.sortOrder ?? -1) + 1 }).returning();
  return { id: row.id };
}

export const CategoryInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(60),
  hall: z.enum(['MEN', 'WOMEN']),
  note: z.string().trim().max(80).nullable(),
  byLength: z.boolean(),
  forKids: z.boolean(),
  active: z.boolean(),
  journalGroup: z.enum(['hair', 'nails', 'brows', 'face']).nullable().optional(),
});

export async function saveCategory(slug: string, input: z.infer<typeof CategoryInput>) {
  const salon = await salonOf(slug);
  if (input.id) {
    const cat = await db.query.serviceCategories.findFirst({ where: and(eq(s.serviceCategories.id, input.id), eq(s.serviceCategories.salonId, salon.id)) });
    if (!cat) throw new Error('Раздел не найден');
    // «по длине волос» меняется только у нового раздела — иначе сломаются цены существующих услуг
    await db.update(s.serviceCategories).set({ name: input.name, hall: input.hall, note: input.note || null, forKids: input.forKids, active: input.active, journalGroup: input.journalGroup ?? null })
      .where(eq(s.serviceCategories.id, cat.id));
    return { id: cat.id };
  }
  const all = await db.query.serviceCategories.findMany({ where: eq(s.serviceCategories.salonId, salon.id) });
  const [row] = await db.insert(s.serviceCategories).values({
    salonId: salon.id, name: input.name, hall: input.hall, note: input.note || null, byLength: input.byLength, forKids: input.forKids, journalGroup: input.journalGroup ?? null,
    active: input.active, sortOrder: Math.max(-1, ...all.map((c) => c.sortOrder)) + 1,
  }).returning();
  return { id: row.id };
}

const Minute = z.number().int().min(0).max(24 * 60);
export const StaffInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(60),
  title: z.string().trim().max(80).nullable(),
  phone: z.string().trim().max(30).nullable(),
  isMaster: z.boolean(),
  commission: z.number().int().min(0).max(100).nullable(),
  active: z.boolean(),
  categoryIds: z.array(z.string()).max(50),
  /** undefined — фото не менять; null — убрать; строка — новое фото (уменьшенное на телефоне) */
  photo: z.string().startsWith('data:image/').max(400_000).nullable().optional(),
  schedule: z.object({
    kind: z.enum(['WEEKLY', 'CYCLE']),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    cycleWork: z.number().int().min(1).max(14).nullable(),
    cycleOff: z.number().int().min(1).max(14).nullable(),
    cycleStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    startMinute: Minute, endMinute: Minute,
    breakStart: Minute.nullable(), breakEnd: Minute.nullable(),
  }).nullable(),
});

/** Добавить или изменить сотрудника: данные, фото, услуги, график, доля */
export async function saveStaff(slug: string, input: z.infer<typeof StaffInput>) {
  const salon = await salonOf(slug);
  const sch = input.schedule;
  if (sch) {
    if (sch.endMinute <= sch.startMinute) throw new Error('Конец рабочего дня должен быть позже начала');
    if (sch.kind === 'WEEKLY' && !sch.weekdays.length) throw new Error('Отметьте рабочие дни недели');
    if (sch.kind === 'CYCLE' && (!sch.cycleWork || !sch.cycleOff || !sch.cycleStart)) throw new Error('Для графика «через день» укажите дни работы, отдыха и первый рабочий день');
    if ((sch.breakStart == null) !== (sch.breakEnd == null)) throw new Error('Укажите и начало, и конец перерыва (или оставьте оба пустыми)');
    if (sch.breakStart != null && sch.breakEnd != null && (sch.breakEnd <= sch.breakStart || sch.breakStart < sch.startMinute || sch.breakEnd > sch.endMinute))
      throw new Error('Перерыв должен быть внутри рабочего дня');
  }
  if (input.isMaster && !sch) throw new Error('У мастера должен быть график');
  const cats = input.categoryIds.length ? await db.query.serviceCategories.findMany({ where: eq(s.serviceCategories.salonId, salon.id) }) : [];
  const catIds = input.categoryIds.filter((id) => cats.some((c) => c.id === id));

  let staffId = input.id;
  const existing = staffId ? await db.query.staff.findFirst({ where: and(eq(s.staff.id, staffId), eq(s.staff.salonId, salon.id)) }) : undefined;
  if (staffId && !existing) throw new Error('Сотрудник не найден');
  const roles = new Set(existing?.roles ?? []);
  if (input.isMaster) roles.add('MASTER'); else roles.delete('MASTER');
  const isOwner = roles.has('OWNER');
  const base = {
    name: input.name, title: input.title || null, phone: input.phone || null, active: isOwner ? true : input.active,
    roles: [...roles], commission: isOwner ? null : input.commission,
  };
  if (existing) {
    await db.update(s.staff).set(base).where(eq(s.staff.id, existing.id));
  } else {
    const all = await db.query.staff.findMany({ where: eq(s.staff.salonId, salon.id) });
    const [row] = await db.insert(s.staff).values({ ...base, salonId: salon.id, sortOrder: Math.max(-1, ...all.map((m) => m.sortOrder)) + 1 }).returning();
    staffId = row.id;
  }
  const id = staffId!;
  if (input.photo !== undefined) {
    await db.update(s.staff).set(input.photo
      ? { photoData: input.photo, photoUrl: `/api/${slug}/staff/${id}/photo?v=${Date.now().toString(36)}` }
      : { photoData: null, photoUrl: null }).where(eq(s.staff.id, id));
  }
  await db.delete(s.staffCategories).where(eq(s.staffCategories.staffId, id));
  if (catIds.length) await db.insert(s.staffCategories).values(catIds.map((categoryId) => ({ staffId: id, categoryId })));
  if (sch) {
    const v = {
      kind: sch.kind, weekdays: sch.kind === 'WEEKLY' ? [...new Set(sch.weekdays)].sort() : [],
      cycleWork: sch.kind === 'CYCLE' ? sch.cycleWork : null, cycleOff: sch.kind === 'CYCLE' ? sch.cycleOff : null,
      cycleStart: sch.kind === 'CYCLE' ? sch.cycleStart : null,
      startMinute: sch.startMinute, endMinute: sch.endMinute, breakStart: sch.breakStart, breakEnd: sch.breakEnd,
    };
    await db.insert(s.schedules).values({ staffId: id, ...v }).onConflictDoUpdate({ target: s.schedules.staffId, set: v });
  }
  return { id };
}

/** Всё для страницы настроек: разделы и услуги (включая скрытые), мастера */
export async function getManageData(slug: string) {
  const salon = await salonOf(slug);
  const categories = await db.query.serviceCategories.findMany({
    where: eq(s.serviceCategories.salonId, salon.id), orderBy: asc(s.serviceCategories.sortOrder),
    with: { services: { orderBy: asc(s.services.sortOrder) }, staff: true },
  });
  const staff = await db.query.staff.findMany({
    where: eq(s.staff.salonId, salon.id), orderBy: asc(s.staff.sortOrder), with: { schedule: true, categories: true },
  });
  return {
    // логотип (большая картинка) в браузер не передаём — он доступен по ссылке logoUrl
    salon: { ...salon, logoData: null, adminPinHash: null },
    categories: categories.map((c) => ({
      id: c.id, name: c.name, hall: c.hall, note: c.note, byLength: c.byLength, forKids: c.forKids, active: c.active, journalGroup: c.journalGroup,
      services: c.services.map((v) => ({
        id: v.id, name: v.name, price: v.price, priceMax: v.priceMax, durationMin: v.durationMin, durationLabel: v.durationLabel,
        pauseAfterMin: v.pauseAfterMin, pauseMin: v.pauseMin, byLength: v.byLength, ageMin: v.ageMin, ageMax: v.ageMax, active: v.active,
      })),
    })),
    staff: staff.map((m) => ({
      id: m.id, name: m.name, title: m.title, phone: m.phone, photoUrl: m.photoUrl, roles: m.roles, commission: m.commission, active: m.active,
      categoryIds: m.categories.map((c) => c.categoryId),
      schedule: m.schedule ? {
        kind: m.schedule.kind, weekdays: m.schedule.weekdays, cycleWork: m.schedule.cycleWork, cycleOff: m.schedule.cycleOff,
        cycleStart: m.schedule.cycleStart ? String(m.schedule.cycleStart) : null, startMinute: m.schedule.startMinute, endMinute: m.schedule.endMinute,
        breakStart: m.schedule.breakStart, breakEnd: m.schedule.breakEnd,
      } : null,
    })),
  };
}
export type ManageData = Awaited<ReturnType<typeof getManageData>>;
