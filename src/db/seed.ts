// Наполнение базы данными салона «Весна» (Бишкек): прайс, мастера, графики.
// Источники: фото прайса и файлы салона, переписка и голосовое владельца от 25.10.2026.
// Запуск: npm run db:seed   (с флагом --demo добавляет демо-записи на ближайшие дни)

import { and, eq } from 'drizzle-orm';
import { db, schema as s } from './index';
import type { ByLength } from './schema';
import { addDays, utcToZoned, zonedToUtc } from '../lib/time';
import { workingHours } from '../lib/schedule';

type Svc = {
  name: string; price?: number; max?: number; dur?: number; label?: string; pause?: [number, number];
  byLength?: ByLength; age?: [number, number]; only?: string[];
};
type Cat = {
  key: string; hall: 'MEN' | 'WOMEN'; name: string; note?: string; byLength?: boolean; forKids?: boolean;
  services: Svc[]; addons?: { name: string; price: number; dur: number; free?: boolean }[];
};

// [цена, минут, как в прайсе, цена «до», выдержка: с какой минуты, сколько минут]
type LP = [number, number, string?, number?, number?, number?];
const L = (short?: LP, medium?: LP, long?: LP, xlong?: LP): ByLength => {
  const out: ByLength = {};
  const put = (k: 'SHORT' | 'MEDIUM' | 'LONG' | 'XLONG', v?: LP) => {
    if (v) out[k] = { price: v[0], dur: v[1], label: v[2] ?? null, max: v[3] ?? null, pa: v[4] ?? null, pm: v[5] ?? null };
  };
  put('SHORT', short); put('MEDIUM', medium); put('LONG', long); put('XLONG', xlong);
  return out;
};

const CATEGORIES: Cat[] = [
  { key: 'mcut', hall: 'MEN', name: 'Мужская стрижка', services: [
    { name: 'Модельная', price: 500, dur: 30, label: '30 мин' },
    { name: 'Спортивная', price: 450, dur: 25, label: '20–30 мин' },
    { name: 'Удлинённая', price: 600, dur: 35, label: '30–40 мин' },
    { name: 'Под одну насадку', price: 250, dur: 15 },
    { name: 'Окантовка', price: 200, dur: 15 },
    { name: 'Налысо', price: 200, dur: 15 },
  ], addons: [
    { name: 'Борода под насадку', price: 50, dur: 10 },
    { name: 'Укладка', price: 150, dur: 10 },
    { name: 'Рисунок', price: 50, dur: 10 },
  ] },
  { key: 'beard', hall: 'MEN', name: 'Борода', services: [{ name: 'Борода + форма', price: 200, dur: 20 }] },
  { key: 'mcolor', hall: 'MEN', name: 'Мужское окрашивание', services: [{ name: 'Покраска (работа)', price: 300, dur: 45, label: '30–45 мин', pause: [10, 20] }],
    addons: [{ name: 'Мужская краска (материал)', price: 300, dur: 0 }] },
  { key: 'kids', hall: 'MEN', name: 'Детская стрижка', note: 'цена по возрасту', forKids: true, services: [
    { name: 'От 1 года до 6 лет', price: 300, dur: 20, age: [1, 6] },
    { name: 'От 7 до 10 лет', price: 350, dur: 20, age: [7, 10] },
    { name: 'От 11 до 14 лет', price: 400, dur: 25, age: [11, 14] },
  ], addons: [{ name: 'Рисунок', price: 50, dur: 10 }] },
  { key: 'mwax', hall: 'MEN', name: 'Депиляция для мужчин', services: [{ name: 'Подмышки', price: 500, dur: 20 }] },

  { key: 'wcut', hall: 'WOMEN', name: 'Женская стрижка', note: 'цена по длине волос', byLength: true, services: [
    { name: 'Стрижка чёлки', price: 200, dur: 15 },
    { name: 'Шапочка / пикси', byLength: L([700, 45]) },
    { name: 'Каре (боб-каре)', byLength: L(undefined, [800, 50]) },
    { name: 'Каскад', byLength: L(undefined, [800, 60], [900, 60], [1100, 70]) },
    { name: 'Лесенка', byLength: L(undefined, undefined, [900, 60], [1100, 70]) },
    { name: 'Подравнивание', byLength: L(undefined, undefined, [800, 30]) },
  ] },
  { key: 'wstyle', hall: 'WOMEN', name: 'Укладки и причёски', note: 'цена по длине волос', byLength: true, services: [
    { name: 'Укладка', byLength: L([500, 40], [600, 45], [700, 50], [1000, 60]) },
    { name: 'Локоны', byLength: L([550, 45], [700, 50], [800, 60], [1200, 75]) },
    { name: 'Причёска', byLength: L(undefined, [800, 60], [900, 75]) },
  ] },
  { key: 'wcolor', hall: 'WOMEN', name: 'Окрашивание (работа)', note: 'краска оплачивается отдельно', byLength: true, services: [
    // Выдержка краски (мастер свободен) — предварительно, уточняется у мастеров
    { name: 'В один тон', byLength: L([600, 105, '1,5–2 ч', undefined, 30, 35], [700, 105, '1,5–2 ч', undefined, 30, 35], [1000, 105, '1,5–2 ч', undefined, 30, 35], [1200, 135, '2–2,5 ч', undefined, 45, 40]) },
    { name: 'Сложное окрашивание', only: ['Анастасия', 'Керемет'],
      byLength: L([2000, 210, '3–4 ч', undefined, 90, 40], [4000, 210, '3–4 ч', undefined, 90, 40], [6000, 240, '3–5 ч', undefined, 110, 40], [8000, 300, '4–6 ч', undefined, 140, 45]) },
    { name: 'Тотал блонд', only: ['Анастасия', 'Керемет'],
      byLength: L([1000, 150, '2–3 ч', 2000, 40, 45], [1500, 150, '2–3 ч', 2500, 40, 45], [1600, 150, '2–3 ч', 3000, 45, 45], [2000, 210, '3–4 ч', 4000, 60, 50]) },
  ] },
  { key: 'wkids', hall: 'WOMEN', name: 'Детям', note: 'в женском зале', forKids: true, services: [
    { name: 'Детская стрижка от 1 до 6 лет', price: 400, dur: 25, age: [1, 6] },
    { name: 'Детская стрижка от 7 до 10 лет', price: 500, dur: 30, age: [7, 10] },
    { name: 'Детская чёлка', price: 100, dur: 10 },
  ] },
  { key: 'mani', hall: 'WOMEN', name: 'Маникюр', services: [
    { name: 'Без покрытия', price: 500, dur: 35, label: '30–40 мин' },
    { name: 'Укрепление базой', price: 700, dur: 40, label: '40 мин' },
    { name: 'Укрепление базой + цветное покрытие', price: 1000, dur: 90, label: '1,5 ч' },
    { name: 'Восстановление стенок + цветное покрытие', price: 1200, dur: 105, label: '1,5–2 ч' },
    { name: 'Японский маникюр', price: 700, dur: 60, label: '1 ч' },
    { name: 'Покрытие базой', price: 200, dur: 20, label: '20 мин' },
  ], addons: [
    { name: 'Снятие покрытия', price: 200, dur: 20, free: true },
    { name: 'Френч', price: 150, dur: 15 },
  ] },
  { key: 'ext', hall: 'WOMEN', name: 'Наращивание ногтей', services: [
    { name: 'Наращивание', price: 1700, dur: 150, label: '2–3 ч' },
    { name: 'Реставрация наращенных ногтей', price: 1400, dur: 120, label: '2 ч' },
    { name: 'Снятие наращенных ногтей', price: 300, dur: 30, label: '30 мин' },
    { name: 'Ремонт 1 ногтя', price: 200, dur: 15, label: '10–15 мин' },
  ] },
  { key: 'pedi', hall: 'WOMEN', name: 'Педикюр', services: [
    { name: 'Гигиенический', price: 1000, dur: 60, label: '1 ч' },
    { name: 'С гель-лаком', price: 1300, dur: 90, label: '1,5 ч' },
  ] },
  { key: 'brows', hall: 'WOMEN', name: 'Брови и ресницы', services: [
    { name: 'Коррекция бровей воском', price: 400, dur: 20 },
    { name: 'Покраска бровей (Estel)', price: 300, dur: 20 },
    { name: 'Ламинирование ресниц + ботокс + покраска', price: 1300, dur: 90, label: '1,5 ч' },
    { name: 'Ламинирование бровей + ботокс + покраска', price: 1300, dur: 90, label: '1,5 ч' },
    { name: 'Снятие наращенных ресниц', price: 300, dur: 20, label: '20 мин' },
  ] },
  { key: 'depil', hall: 'WOMEN', name: 'Депиляция (шугаринг)', services: [
    { name: 'Бикини', price: 1000, dur: 40 },
    { name: 'Ноги полностью', price: 900, dur: 45 },
    { name: 'Ноги до колен', price: 700, dur: 30 },
    { name: 'Руки полностью', price: 700, dur: 30 },
    { name: 'Подмышки / затылок / баки', price: 400, dur: 15 },
    { name: 'Лицо', price: 900, dur: 30 },
    { name: 'Спина полностью', price: 800, dur: 30 },
    { name: 'Усики', price: 200, dur: 10 },
  ] },
];

const HAIR_ALL = ['mcut', 'beard', 'mcolor', 'kids', 'wcut', 'wstyle', 'wcolor', 'wkids'];

type StaffDef = {
  name: string; title: string; photo?: string; roles: ('OWNER' | 'ADMIN' | 'MASTER' | 'MANAGER')[]; commission?: number | null;
  cats: string[];
  schedule: { kind: 'WEEKLY'; weekdays: number[]; start: number; end: number } | { kind: 'CYCLE'; work: number; off: number; from: string; start: number; end: number };
};

const H = (h: number, m = 0) => h * 60 + m;

const STAFF: StaffDef[] = [
  { name: 'Сурмакан', title: 'Маникюр, педикюр, наращивание ногтей', photo: '/masters/v2/surmakan.jpg', roles: ['OWNER', 'MASTER'],
    cats: ['mani', 'ext', 'pedi'], schedule: { kind: 'WEEKLY', weekdays: [0, 1, 2, 3, 4], start: H(9), end: H(15) } },
  { name: 'Анастасия', title: 'Мужские и женские стрижки, сложные стрижки и окрашивание', photo: '/masters/v2/anastasia.jpg', roles: ['MASTER'],
    cats: HAIR_ALL, schedule: { kind: 'WEEKLY', weekdays: [2, 3, 5, 6], start: H(9, 30), end: H(19) } },
  { name: 'Диана', title: 'Мужские и женские стрижки, окрашивание в один тон, укладки', photo: '/masters/v2/diana.jpg', roles: ['MASTER'],
    cats: HAIR_ALL, schedule: { kind: 'WEEKLY', weekdays: [0, 1, 2, 5, 6], start: H(9, 30), end: H(20) } },
  { name: 'Керемет', title: 'Универсал: стрижки, укладки, окрашивание', photo: '/masters/v2/keremet.jpg', roles: ['MASTER'],
    cats: HAIR_ALL, schedule: { kind: 'WEEKLY', weekdays: [1, 2, 3, 4], start: H(9), end: H(15) } },
  { name: 'Жаннат', title: 'Мужские стрижки', photo: '/masters/v2/zhannat.jpg', roles: ['MASTER'],
    cats: ['mcut', 'beard', 'mcolor', 'kids'], schedule: { kind: 'WEEKLY', weekdays: [0, 3, 4, 5, 6], start: H(9, 30), end: H(20) } },
  // Выходной дни у графиков «6 через 1» уточняются у салона; дата отсчёта — предположение.
  { name: 'Жамиля', title: 'Маникюр, педикюр, наращивание', photo: '/masters/v2/jamilya.jpg', roles: ['MASTER'],
    cats: ['mani', 'ext', 'pedi'], schedule: { kind: 'CYCLE', work: 6, off: 1, from: '2026-10-27', start: H(9, 30), end: H(20) } },
  { name: 'Азиза', title: 'Маникюр и педикюр с покрытием, гигиенический', photo: '/masters/v2/aziza.jpg', roles: ['MASTER'],
    cats: ['mani', 'pedi'], schedule: { kind: 'CYCLE', work: 6, off: 1, from: '2026-10-26', start: H(9, 30), end: H(20) } },
  { name: 'Залина', title: 'Шугаринг, брови, ламинирование ресниц и бровей', photo: '/masters/v2/zalina.jpg', roles: ['MASTER'],
    cats: ['brows', 'depil', 'mwax'], schedule: { kind: 'CYCLE', work: 6, off: 1, from: '2026-10-26', start: H(9, 30), end: H(20) } },
  // Администратор — отдельная штатная единица, клиентов не обслуживает. График уточняется у салона.
  { name: 'Рэйна', title: 'Администратор', roles: ['ADMIN'],
    cats: [], schedule: { kind: 'WEEKLY', weekdays: [0, 1, 2, 3, 4, 5, 6], start: H(9, 30), end: H(20) } },
];

async function insertStaff(salonId: string, m: StaffDef, i: number, catIds: Map<string, string>) {
  const [row] = await db.insert(s.staff).values({
    salonId, name: m.name, title: m.title, photoUrl: m.photo ?? null, roles: m.roles,
    commission: m.roles.includes('OWNER') ? 0 : null, sortOrder: i,
  }).returning();
  const sc = m.schedule;
  await db.insert(s.schedules).values(sc.kind === 'WEEKLY'
    ? { staffId: row.id, kind: 'WEEKLY', weekdays: sc.weekdays, startMinute: sc.start, endMinute: sc.end }
    : { staffId: row.id, kind: 'CYCLE', cycleWork: sc.work, cycleOff: sc.off, cycleStart: sc.from, startMinute: sc.start, endMinute: sc.end });
  for (const key of m.cats) await db.insert(s.staffCategories).values({ staffId: row.id, categoryId: catIds.get(key)! });
  return row.id;
}

async function main() {
  const demo = process.argv.includes('--demo');
  // --if-empty: при публикации не трогаем уже существующий салон (и его записи)
  if (process.argv.includes('--if-empty')) {
    const existing = await db.query.salons.findFirst({ where: eq(s.salons.slug, 'vesna') });
    if (existing) {
      // Данные и записи не трогаем: только добавляем новых сотрудников и подтягиваем новые фото
      const cats = await db.query.serviceCategories.findMany({ where: eq(s.serviceCategories.salonId, existing.id) });
      const catIds = new Map<string, string>();
      for (const c of CATEGORIES) { const row = cats.find((x) => x.name === c.name && x.hall === c.hall); if (row) catIds.set(c.key, row.id); }
      for (const [i, m] of STAFF.entries()) {
        const found = await db.query.staff.findFirst({ where: and(eq(s.staff.salonId, existing.id), eq(s.staff.name, m.name)) });
        if (!found) { await insertStaff(existing.id, m, i, catIds); console.log(`Добавлен сотрудник: ${m.name}`); }
        else if ((m.photo && found.photoUrl !== m.photo) || found.title !== m.title) {
          await db.update(s.staff).set({ photoUrl: m.photo ?? found.photoUrl, title: m.title }).where(eq(s.staff.id, found.id));
        }
      }
      // выдержка краски и длительности окрашивания — из прайса
      for (const c of CATEGORIES) for (const v of c.services) {
        const catId = catIds.get(c.key); if (!catId) continue;
        if (!v.pause && !v.byLength) continue;
        await db.update(s.services).set({
          byLength: v.byLength ?? null, durationMin: v.dur ?? null, durationLabel: v.label ?? null,
          pauseAfterMin: v.pause?.[0] ?? null, pauseMin: v.pause?.[1] ?? null,
        }).where(and(eq(s.services.categoryId, catId), eq(s.services.name, v.name)));
      }
      console.log('Салон «Весна» уже в базе — обновлены сотрудники, фото и выдержка окрашивания.'); return;
    }
  }

  await db.delete(s.salons).where(eq(s.salons.slug, 'vesna'));
  const [salon] = await db.insert(s.salons).values({
    slug: 'vesna', name: 'Весна', tagline: 'Салон красоты', city: 'Бишкек', address: '5 мкр, дом 44',
    whatsapp: '+996 702 81-45-55', phone: '+996 997 81-45-55', instagram: 'vesna_salon.kg', logoUrl: '/logo.jpg',
    accentColor: '#4E6B45', bookingHorizonDays: 30, minLeadMinutes: 60, defaultCommission: 50,
  }).returning();

  const catIds = new Map<string, string>();
  const serviceIds = new Map<string, string>();
  for (const [ci, c] of CATEGORIES.entries()) {
    const [cat] = await db.insert(s.serviceCategories).values({
      salonId: salon.id, hall: c.hall, name: c.name, note: c.note, byLength: !!c.byLength, forKids: !!c.forKids, sortOrder: ci,
    }).returning();
    catIds.set(c.key, cat.id);
    for (const [si, v] of c.services.entries()) {
      const [row] = await db.insert(s.services).values({
        categoryId: cat.id, name: v.name, price: v.price ?? null, priceMax: v.max ?? null, durationMin: v.dur ?? null,
        durationLabel: v.label ?? null, byLength: v.byLength ?? null, ageMin: v.age?.[0] ?? null, ageMax: v.age?.[1] ?? null,
        pauseAfterMin: v.pause?.[0] ?? null, pauseMin: v.pause?.[1] ?? null, sortOrder: si,
      }).returning();
      serviceIds.set(`${c.key}:${v.name}`, row.id);
    }
    for (const [ai, a] of (c.addons ?? []).entries()) {
      await db.insert(s.addons).values({
        categoryId: cat.id, name: a.name, price: a.price, durationMin: a.dur, rule: a.free ? 'FREE_IF_REPEAT' : null, sortOrder: ai,
      });
    }
  }

  const staffIds = new Map<string, string>();
  for (const [i, m] of STAFF.entries()) staffIds.set(m.name, await insertStaff(salon.id, m, i, catIds));

  for (const c of CATEGORIES) for (const v of c.services) for (const who of v.only ?? []) {
    await db.insert(s.serviceRestrictions).values({ serviceId: serviceIds.get(`${c.key}:${v.name}`)!, staffId: staffIds.get(who)! });
  }

  if (demo) await seedDemo(salon.id, staffIds, serviceIds);
  console.log(`Готово: салон «${salon.name}», ${CATEGORIES.length} категорий, услуг: ${serviceIds.size}, мастеров: ${STAFF.length}${demo ? ', демо-записи' : ''}.`);
}

async function seedDemo(salonId: string, staffIds: Map<string, string>, serviceIds: Map<string, string>) {
  const tz = 'Asia/Bishkek';
  const today = utcToZoned(new Date(), tz).date;
  const [aida] = await db.insert(s.clients).values({ salonId, name: 'Аида Садыкова', phone: '+996555000214', points: 640 }).returning();
  await db.insert(s.clients).values({ salonId, name: 'Алихан', birthDate: '2018-03-15', guardianId: aida.id });
  const names = ['Тимур', 'Данияр', 'Асель', 'Дарья', 'Нурлан', 'Самат', 'Дина', 'Нургуль', 'Айпери', 'Гульнара'];
  const clientIds: string[] = [];
  for (const [i, n] of names.entries()) {
    const [c] = await db.insert(s.clients).values({ salonId, name: n, phone: `+99670000${String(i).padStart(4, '0')}` }).returning();
    clientIds.push(c.id);
  }
  const plan: [number, string, string, string, number, number, string?][] = [
    // [день от сегодня, мастер, услуга, клиент, начало (мин), длительность, длина]
    [1, 'Диана', 'mcut:Модельная', 'Тимур', H(10), 30],
    [1, 'Диана', 'mcut:Окантовка', 'Данияр', H(10, 30), 15],
    [1, 'Диана', 'wcut:Каскад', 'Асель', H(12), 60, 'LONG'],
    [1, 'Жаннат', 'mcut:Спортивная', 'Нурлан', H(10), 25],
    [1, 'Жаннат', 'mcut:Удлинённая', 'Самат', H(11), 35],
    [1, 'Азиза', 'mani:Укрепление базой + цветное покрытие', 'Дина', H(10), 90],
    [1, 'Азиза', 'pedi:С гель-лаком', 'Нургуль', H(12), 90],
    [1, 'Залина', 'brows:Ламинирование ресниц + ботокс + покраска', 'Айпери', H(10), 90],
    [1, 'Залина', 'depil:Ноги полностью', 'Гульнара', H(14), 45],
    [1, 'Сурмакан', 'mani:Укрепление базой + цветное покрытие', 'Аида', H(11), 90],
    // окрашивание с выдержкой: в выдержку у Анастасии стрижка
    [1, 'Анастасия', 'wcolor:В один тон', 'Дарья', H(10), 105, 'SHORT'],
    [1, 'Анастасия', 'mcut:Модельная', 'Данияр', H(10, 30), 30],
  ];
  for (const [dd, who, key, client, start, dur, len] of plan) {
    // ближайший рабочий день мастера, начиная с завтра
    const sched = await db.query.schedules.findFirst({ where: eq(s.schedules.staffId, staffIds.get(who)!) });
    let date = addDays(today, dd);
    for (let i = 0; i < 7 && !workingHours(sched ?? null, [], date); i++) date = addDays(date, 1);
    const serviceId = serviceIds.get(key);
    if (!serviceId) continue;
    const clientId = client === 'Аида' ? aida.id : clientIds[names.indexOf(client)];
    const svc = await db.query.services.findFirst({ where: eq(s.services.id, serviceId) });
    const lp = len && svc?.byLength ? svc.byLength[len as 'LONG'] : null;
    const price = lp ? lp.price : svc?.price ?? 0;
    await db.insert(s.appointments).values({
      salonId, staffId: staffIds.get(who)!, clientId, serviceId, hairLength: (len as 'LONG') ?? null,
      startsAt: zonedToUtc(date, start, tz), endsAt: zonedToUtc(date, start + dur, tz), price, source: 'ONLINE',
      pauseStart: lp?.pa ?? null, pauseMin: lp?.pm ?? null,
    });
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
