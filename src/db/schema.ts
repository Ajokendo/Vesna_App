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
export const genderEnum = pgEnum('gender', ['F', 'M']);

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
  /** Опоздание: через сколько минут после начала записи напомнить администратору позвонить клиенту */
  lateCallMinutes: integer('late_call_minutes').notNull().default(5),
  /** Через сколько минут можно отметить «не пришёл» и отдать время другому клиенту */
  noShowMinutes: integer('no_show_minutes').notNull().default(15),
  /** Сколько процентов от оплаченных деньгами возвращается клиенту баллами (1 балл = 1 сом) */
  pointsPercent: integer('points_percent').notNull().default(5),
  /** День рождения клиента: поздравлять ли (push утром в день рождения) и сколько баллов дарить (0 — только поздравление) */
  birthdayGreet: boolean('birthday_greet').notNull().default(true),
  birthdayBonus: integer('birthday_bonus').notNull().default(100),
  /** Подарочные баллы за первую установку приложения на телефон (0 — не дарить) */
  welcomeBonus: integer('welcome_bonus').notNull().default(100),
  /** Баллы можно тратить, когда на счёте набралось не меньше стольких (0 — сразу) */
  minRedeem: integer('min_redeem').notNull().default(500),
  /** Баллы за приглашённого друга (начисляются после первой оплаты друга; 0 — программа выключена) и лимит в месяц */
  referralBonus: integer('referral_bonus').notNull().default(50),
  referralMonthlyLimit: integer('referral_monthly_limit').notNull().default(10),
  /** Баллы за отзыв в 2ГИС (начисляет администратор, проверив отзыв; 0 — не предлагать) */
  reviewBonus: integer('review_bonus').notNull().default(50),
  /** Логотип, загруженный в настройках (квадрат PNG, data:…) — отдаётся по /api/<салон>/logo */
  logoData: text('logo_data'),
  /** Тексты главной страницы */
  hoursText: text('hours_text'),
  /** Ссылка на салон в 2ГИС (кнопка «Как добраться»); пусто — поиск по адресу */
  mapUrl: text('map_url'),
  menHallNote: text('men_hall_note'),
  womenHallNote: text('women_hall_note'),
  /** PIN администратора салона (хеш). Пусто — старый общий PIN из настроек сервера (только для первого салона) */
  adminPinHash: text('admin_pin_hash'),
  /** Код первичной настройки (хеш): с ним владелец нового салона задаёт PIN администратора */
  setupCodeHash: text('setup_code_hash'),
  adminPinFailed: integer('admin_pin_failed').notNull().default(0),
  /** PIN хозяйки (хеш) — вход в кабинет с отчётами о выручке, зарплатах и прибыли; администратор его не знает */
  ownerPinHash: text('owner_pin_hash'),
  ownerPinFailed: integer('owner_pin_failed').notNull().default(0),
  ownerPinLockedUntil: timestamp('owner_pin_locked_until', { withTimezone: true }),
  adminPinLockedUntil: timestamp('admin_pin_locked_until', { withTimezone: true }),
  /** Демо-доступ: после этого момента приложение салона закрыто (пусто — без ограничения) */
  demoUntil: timestamp('demo_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const staff = pgTable('staff', {
  id: id(),
  salonId: text('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone'),
  photoUrl: text('photo_url'),
  /** Фото, загруженное в настройках (data:image/jpeg;base64,…) — отдаётся по /api/<салон>/staff/<id>/photo */
  photoData: text('photo_data'),
  title: text('title'),
  /** Одному человеку можно выдать несколько ролей (например, владелец и мастер) */
  roles: roleEnum('roles').array().notNull().default([]),
  /** null — комиссия салона по умолчанию; у владельца-мастера комиссия не начисляется */
  commission: integer('commission'),
  /** Вход в кабинет мастера: PIN хранится только в виде хеша (scrypt) */
  pinHash: text('pin_hash'),
  pinFailed: integer('pin_failed').notNull().default(0),
  pinLockedUntil: timestamp('pin_locked_until', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  /** Показывать клиентам рейтинг мастера (включает хозяйка, для каждого мастера отдельно; виден от 10 оценок) */
  showRating: boolean('show_rating').notNull().default(false),
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
  /** Вкладка журнала: hair — волосы, nails — ногти, brows — брови и шугаринг, face — косметология (пусто — по названию) */
  journalGroup: text('journal_group'),
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
  /** Пол — для поздравлений (8 Марта); подставляется по залу, куда клиент записывается */
  gender: genderEnum('gender'),
  /** Клиент отписался от поздравлений и акций (сообщения о его записях приходят всегда) */
  promoOptOut: boolean('promo_opt_out').notNull().default(false),
  /** Когда начислен подарок за установку приложения (один раз на клиента) */
  welcomeBonusAt: timestamp('welcome_bonus_at', { withTimezone: true }),
  /** Код приглашения (в ссылке ?ref=…) */
  referralCode: text('referral_code'),
  /** Кто пригласил этого клиента и когда пригласившему начислены баллы */
  referredById: text('referred_by_id'),
  referralRewardedAt: timestamp('referral_rewarded_at', { withTimezone: true }),
  /** Для детей и родственников: чей это член семьи */
  guardianId: text('guardian_id'),
  /** В каком году уже поздравили с днём рождения (чтобы не поздравить дважды) */
  birthdayGiftYear: integer('birthday_gift_year'),
  /** Заметка администратора о клиенте (аллергия, любимый мастер, особенности) — клиент её не видит */
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('client_salon_phone').on(t.salonId, t.phone), index('client_salon_idx').on(t.salonId), uniqueIndex('client_ref_code').on(t.salonId, t.referralCode)]);

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
  /** Время окончания поменяли (мастер закончит раньше / задержится): каким оно было по записи, кто и когда поменял */
  plannedEndsAt: timestamp('planned_ends_at', { withTimezone: true }),
  endChangedBy: text('end_changed_by'),
  endChangedAt: timestamp('end_changed_at', { withTimezone: true }),
  /** Клиент пришёл (отметка администратора или мастера) */
  arrivedAt: timestamp('arrived_at', { withTimezone: true }),
  /** Клиент сам предупредил, что опоздает на N минут */
  lateMinutes: integer('late_minutes'),
  lateReportedAt: timestamp('late_reported_at', { withTimezone: true }),
  /** Кто отменил запись: ADMIN, CLIENT */
  cancelledBy: text('cancelled_by'),
  /** Клиент подтвердил визит (кнопка в утреннем уведомлении) */
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
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

/** Служебные настройки приложения (ключи push-уведомлений, секрет ссылок) */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/** Телефоны клиентов, разрешившие push-уведомления */
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: id(),
  salonId: text('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('push_client_idx').on(t.clientId)]);

export const notificationKindEnum = pgEnum('notification_kind', ['BOOKED', 'MORNING', 'HOUR', 'MOVED', 'CANCELLED', 'RATE']);

/** Какие уведомления по записи уже отправлены — чтобы не слать повторно */
export const appointmentNotifications = pgTable('appointment_notifications', {
  appointmentId: text('appointment_id').notNull().references(() => appointments.id, { onDelete: 'cascade' }),
  kind: notificationKindEnum('kind').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  delivered: integer('delivered').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.appointmentId, t.kind] })]);

/** Рассылки салона: «нет света», праздники, акции */
export const broadcasts = pgTable('broadcasts', {
  id: id(),
  salonId: text('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  /** SERVICE — важное о работе салона (уходит всем выбранным), PROMO — поздравления и акции (кроме отписавшихся) */
  kind: text('kind').notNull(),
  audience: text('audience').notNull(),
  recipients: integer('recipients').notNull().default(0),
  delivered: integer('delivered').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

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

/** Сообщения разработчикам из приложения (клиенты, мастера, администраторы любого салона) */
export const feedback = pgTable('feedback', {
  id: id(),
  salonSlug: text('salon_slug'),
  /** CLIENT | MASTER | ADMIN */
  role: text('role').notNull(),
  text: text('text').notNull(),
  contact: text('contact'),
  /** Страница и сведения о телефоне (если клиент разрешил) */
  page: text('page'),
  device: text('device'),
  resolved: boolean('resolved').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('feedback_created').on(t.createdAt)]);

/** Оценка визита клиентом: звёзды 1–5 и необязательный отзыв. Одна оценка на визит */
export const reviews = pgTable('reviews', {
  id: id(),
  salonId: text('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  appointmentId: text('appointment_id').notNull().unique().references(() => appointments.id, { onDelete: 'cascade' }),
  staffId: text('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  stars: integer('stars').notNull(),
  text: text('text'),
  /** Клиент перешёл оставить отзыв в 2ГИС; когда администратор, проверив, начислил баллы */
  gisClickedAt: timestamp('gis_clicked_at', { withTimezone: true }),
  gisRewardedAt: timestamp('gis_rewarded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('reviews_staff').on(t.staffId)]);
export const reviewsRelations = relations(reviews, ({ one }) => ({
  staff: one(staff, { fields: [reviews.staffId], references: [staff.id] }),
  client: one(clients, { fields: [reviews.clientId], references: [clients.id] }),
  appointment: one(appointments, { fields: [reviews.appointmentId], references: [appointments.id] }),
}));

/** Расходы салона (вносит хозяйка): аренда, материалы, свет и т. п. — для расчёта прибыли */
export const expenses = pgTable('expenses', {
  id: id(),
  salonId: text('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  /** День расхода, YYYY-MM-DD по времени салона */
  date: date('date', { mode: 'string' }).notNull(),
  category: text('category').notNull(),
  amount: integer('amount').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('expenses_salon_date').on(t.salonId, t.date)]);

/** Лист ожидания: клиент просит сообщить, если в этот день освободится время (у мастера или у любого) */
export const waitlist = pgTable('waitlist', {
  id: id(),
  salonId: text('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  serviceId: text('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  /** Мастер; пусто — любой свободный */
  staffId: text('staff_id').references(() => staff.id, { onDelete: 'cascade' }),
  date: date('date', { mode: 'string' }).notNull(),
  hairLength: hairLengthEnum('hair_length'),
  addonIds: jsonb('addon_ids').$type<string[]>().notNull().default([]),
  /** Когда последний раз сообщили, что время освободилось */
  notifiedAt: timestamp('notified_at', { withTimezone: true }),
  /** Заявка закрыта: клиент записался, отменил заявку или администратор убрал */
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('waitlist_salon_date').on(t.salonId, t.date)]);
export const waitlistRelations = relations(waitlist, ({ one }) => ({
  client: one(clients, { fields: [waitlist.clientId], references: [clients.id] }),
  service: one(services, { fields: [waitlist.serviceId], references: [services.id] }),
  staff: one(staff, { fields: [waitlist.staffId], references: [staff.id] }),
}));

/** Вход по отпечатку / Face ID (passkey): ключ телефона, привязанный к роли и человеку в салоне */
export const passkeys = pgTable('passkeys', {
  id: id(),
  salonId: text('salon_id').notNull().references(() => salons.id, { onDelete: 'cascade' }),
  /** ADMIN | OWNER | MASTER | CLIENT */
  role: text('role').notNull(),
  /** Мастер или клиент (для администратора и хозяйки — пусто) */
  subjectId: text('subject_id'),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  transports: jsonb('transports').$type<string[]>(),
  device: text('device'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('passkeys_salon_role').on(t.salonId, t.role)]);
