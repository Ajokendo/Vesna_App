// Схема данных универсального приложения для салонов красоты.
// Всё, что относится к конкретному салону (название, услуги, цены, мастера, графики),
// хранится в данных, а не в коде: «Весна» — первый салон в системе.

import { relations } from 'drizzle-orm';
import {
  boolean, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());

export const roleEnum = pgEnum('role', ['OWNER', 'MANAGER', 'ADMIN', 'MASTER']);
export const scheduleKindEnum = pgEnum('schedule_kind', ['WEEKLY', 'CYCLE']);
export const hallEnum = pgEnum('hall', ['MEN', 'WOMEN']);
export const hairLengthEnum = pgEnum('hair_length', ['SHORT', 'MEDIUM', 'LONG', 'XLONG']);
export const addonRuleEnum = pgEnum('addon_rule', ['FREE_IF_REPEAT']);
export const appointmentStatusEnum = pgEnum('appointment_status', ['BOOKED', 'CONFIRMED', 'ARRIVED', 'DONE', 'CANCELLED', 'NO_SHOW']);
export const appointmentSourceEnum = pgEnum('appointment_source', ['ONLINE', 'ADMIN', 'WALK_IN']);

export type HairLength = (typeof hairLengthEnum.enumValues)[number];
export type Role = (typeof roleEnum.enumValues)[number];

export const salons = pgTable('salons', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  tagline: text('tagline'),
  city: text('city'),
  address: text('address'),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  instagram: text('instagram'),
  logoUrl: text('logo_url'),
  accentColor: text('accent_color').notNull().default('#4E6B45'),
  timezone: text('timezone').notNull().default('Asia/Bishkek'),
  currency: text('currency').notNull().default('KGS'),
  /** На сколько дней вперёд клиент может записаться */
  bookingHorizonDays: integer('booking_horizon_days').notNull().default(30),
  /** Не позже чем за сколько минут до начала можно записаться онлайн */
  minLeadMinutes: integer('min_lead_minutes').notNull().default(60),
  /** Точность расписания, минуты */
  slotStepMinutes: integer('slot_step_minutes').notNull().default(5),
  /** Сетка, по которой клиенту предлагаются окна, минуты */
  displayStepMinutes: integer('display_step_minutes').notNull().default(15),
  /** Комиссия мастера по умолчанию, % */
  defaultCommission: integer('default_commission').notNull().default(50),
  /** Сколько процентов от оплаченных деньгами возвращается клиенту баллами (1 балл = 1 сом) */
  pointsPercent: integer('points_percent').notNull().default(5),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const staff = pgTable('staff', {
  id: id(),
  salonId: text('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone'),
  photoUrl: text('photo_url'),
  title: text('title'),
  /** Одному человеку можно выдать несколько ролей (например, владелец и мастер) */
  roles: roleEnum('roles').array().notNull().default([]),
  /** null — комиссия салона по умолчанию; у владельца-мастера комиссия не начисляется */
  commission: integer('commission'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [index('staff_salon_idx').on(t.salonId)]);

export const schedules = pgTable('schedules', {
  id: id(),
  staffId: text('staff_id').notNull().unique().references(() => staff.id, { onDelete: 'cascade' }),
  kind: scheduleKindEnum('kind').notNull(),
  /** WEEKLY: 0 = понедельник … 6 = воскресенье */
  weekdays: integer('weekdays').array().notNull().default([]),
  /** CYCLE: дней работы, дней отдыха и с какой даты считать */
  cycleWork: integer('cycle_work'),
  cycleOff: integer('cycle_off'),
  cycleStart: date('cycle_start'),
  /** Минуты от полуночи по времени салона */
  startMinute: integer('start_minute').notNull(),
  endMinute: integer('end_minute').notNull(),
  breakStart: integer('break_start'),
  breakEnd: integer('break_end'),
});

export const scheduleExceptions = pgTable('schedule_exceptions', {
  id: id(),
  staffId: text('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  dayOff: boolean('day_off').notNull().default(true),
  startMinute: integer('start_minute'),
  endMinute: integer('end_minute'),
  note: text('note'),
}, (t) => [uniqueIndex('schedule_exception_day').on(t.staffId, t.date)]);

export const serviceCategories = pgTable('service_categories', {
  id: id(),
  salonId: text('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  hall: hallEnum('hall').notNull(),
  name: text('name').notNull(),
  note: text('note'),
  /** Цена и длительность зависят от длины волос */
  byLength: boolean('by_length').notNull().default(false),
  /** Детская категория: вариант выбирается по возрасту ребёнка */
  forKids: boolean('for_kids').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
}, (t) => [index('category_salon_idx').on(t.salonId)]);

export const staffCategories = pgTable('staff_categories', {
  staffId: text('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').notNull().references(() => serviceCategories.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.staffId, t.categoryId] })]);

/** pa — через сколько минут от начала начинается выдержка (краска впитывается), pm — сколько она длится */
export type LengthPrice = { price: number; max?: number | null; dur: number; label?: string | null; pa?: number | null; pm?: number | null };
export type ByLength = Partial<Record<HairLength, LengthPrice>>;

export const services = pgTable('services', {
  id: id(),
  categoryId: text('category_id').notNull().references(() => serviceCategories.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** Цена в сомах; для «от–до» — нижняя граница */
  price: integer('price'),
  priceMax: integer('price_max'),
  durationMin: integer('duration_min'),
  /** Как длительность написана в прайсе («1,5–2 ч») */
  durationLabel: text('duration_label'),
  /** Для категорий по длине волос */
  byLength: jsonb('by_length').$type<ByLength>(),
  /** Возрастной диапазон для детских цен */
  ageMin: integer('age_min'),
  ageMax: integer('age_max'),
  /** Выдержка: мастер свободен и может принять другого клиента (для услуг по длине — в byLength) */
  pauseAfterMin: integer('pause_after_min'),
  pauseMin: integer('pause_min'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

/** Если для услуги есть строки — её делают только эти мастера (например, сложное окрашивание) */
export const serviceRestrictions = pgTable('service_restrictions', {
  serviceId: text('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  staffId: text('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.serviceId, t.staffId] })]);

export const addons = pgTable('addons', {
  id: id(),
  categoryId: text('category_id').notNull().references(() => serviceCategories.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  durationMin: integer('duration_min').notNull().default(0),
  rule: addonRuleEnum('rule'),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

export const clients = pgTable('clients', {
  id: id(),
  salonId: text('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone'),
  birthDate: date('birth_date'),
  points: integer('points').notNull().default(0),
  /** Для детей и родственников: чей это член семьи */
  guardianId: text('guardian_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('client_salon_phone').on(t.salonId, t.phone), index('client_salon_idx').on(t.salonId)]);

export const appointments = pgTable('appointments', {
  id: id(),
  salonId: text('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  staffId: text('staff_id').notNull().references(() => staff.id),
  clientId: text('client_id').notNull().references(() => clients.id),
  serviceId: text('service_id').notNull().references(() => services.id),
  hairLength: hairLengthEnum('hair_length'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  /** Выдержка внутри записи: минут от начала и длительность; в это время мастер свободен */
  pauseStart: integer('pause_start'),
  pauseMin: integer('pause_min'),
  /** Цена при записи (для «от–до» — нижняя граница до консультации) */
  price: integer('price').notNull(),
  priceMax: integer('price_max'),
  // ——— оплата (заполняется на кассе) ———
  /** Сколько стоила услуга по факту */
  finalPrice: integer('final_price'),
  pointsUsed: integer('points_used').notNull().default(0),
  /** Оплачено деньгами = finalPrice − pointsUsed; с этой суммы считаются баллы и доля мастера */
  cashPaid: integer('cash_paid'),
  pointsEarned: integer('points_earned').notNull().default(0),
  masterPercent: integer('master_percent'),
  masterShare: integer('master_share'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  status: appointmentStatusEnum('status').notNull().default('BOOKED'),
  source: appointmentSourceEnum('source').notNull().default('ONLINE'),
  paid: boolean('paid').notNull().default(false),
  paymentMethod: text('payment_method'),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('appt_salon_time').on(t.salonId, t.startsAt), index('appt_staff_time').on(t.staffId, t.startsAt)]);

export const appointmentAddons = pgTable('appointment_addons', {
  appointmentId: text('appointment_id').notNull().references(() => appointments.id, { onDelete: 'cascade' }),
  addonId: text('addon_id').notNull().references(() => addons.id),
  price: integer('price').notNull(),
}, (t) => [primaryKey({ columns: [t.appointmentId, t.addonId] })]);

export const pointsKindEnum = pgEnum('points_kind', ['EARN', 'REDEEM', 'ADJUST']);

/** Движение баллов: начисление за оплату, списание в счёт оплаты, ручная корректировка */
export const pointsLedger = pgTable('points_ledger', {
  id: id(),
  salonId: text('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  appointmentId: text('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),
  kind: pointsKindEnum('kind').notNull(),
  /** + начислено, − списано */
  delta: integer('delta').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('points_client_idx').on(t.clientId)]);

// ——— связи для удобных запросов ———

export const salonsRelations = relations(salons, ({ many }) => ({
  staff: many(staff), categories: many(serviceCategories), clients: many(clients), appointments: many(appointments),
}));
export const staffRelations = relations(staff, ({ one, many }) => ({
  salon: one(salons, { fields: [staff.salonId], references: [salons.id] }),
  schedule: one(schedules, { fields: [staff.id], references: [schedules.staffId] }),
  exceptions: many(scheduleExceptions),
  categories: many(staffCategories),
  restrictions: many(serviceRestrictions),
  appointments: many(appointments),
}));
export const schedulesRelations = relations(schedules, ({ one }) => ({
  staff: one(staff, { fields: [schedules.staffId], references: [staff.id] }),
}));
export const scheduleExceptionsRelations = relations(scheduleExceptions, ({ one }) => ({
  staff: one(staff, { fields: [scheduleExceptions.staffId], references: [staff.id] }),
}));
export const categoriesRelations = relations(serviceCategories, ({ one, many }) => ({
  salon: one(salons, { fields: [serviceCategories.salonId], references: [salons.id] }),
  services: many(services), addons: many(addons), staff: many(staffCategories),
}));
export const staffCategoriesRelations = relations(staffCategories, ({ one }) => ({
  staff: one(staff, { fields: [staffCategories.staffId], references: [staff.id] }),
  category: one(serviceCategories, { fields: [staffCategories.categoryId], references: [serviceCategories.id] }),
}));
export const servicesRelations = relations(services, ({ one, many }) => ({
  category: one(serviceCategories, { fields: [services.categoryId], references: [serviceCategories.id] }),
  restrictions: many(serviceRestrictions), appointments: many(appointments),
}));
export const serviceRestrictionsRelations = relations(serviceRestrictions, ({ one }) => ({
  service: one(services, { fields: [serviceRestrictions.serviceId], references: [services.id] }),
  staff: one(staff, { fields: [serviceRestrictions.staffId], references: [staff.id] }),
}));
export const addonsRelations = relations(addons, ({ one }) => ({
  category: one(serviceCategories, { fields: [addons.categoryId], references: [serviceCategories.id] }),
}));
export const clientsRelations = relations(clients, ({ one, many }) => ({
  salon: one(salons, { fields: [clients.salonId], references: [salons.id] }),
  guardian: one(clients, { fields: [clients.guardianId], references: [clients.id], relationName: 'family' }),
  family: many(clients, { relationName: 'family' }),
  appointments: many(appointments),
}));
export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  salon: one(salons, { fields: [appointments.salonId], references: [salons.id] }),
  staff: one(staff, { fields: [appointments.staffId], references: [staff.id] }),
  client: one(clients, { fields: [appointments.clientId], references: [clients.id] }),
  service: one(services, { fields: [appointments.serviceId], references: [services.id] }),
  addons: many(appointmentAddons),
}));
export const appointmentAddonsRelations = relations(appointmentAddons, ({ one }) => ({
  appointment: one(appointments, { fields: [appointmentAddons.appointmentId], references: [appointments.id] }),
  addon: one(addons, { fields: [appointmentAddons.addonId], references: [addons.id] }),
}));
