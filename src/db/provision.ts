// Применяет src/db/salons.config.ts: создаёт новые салоны и обновляет срок демо-доступа.
// Запускается при каждой публикации, повторный запуск ничего не ломает.
import { asc, eq } from 'drizzle-orm';
import { db, schema as s } from './index';
import { SALONS } from './salons.config';

async function copyCatalog(fromSlug: string, toSalonId: string) {
  const from = await db.query.salons.findFirst({ where: eq(s.salons.slug, fromSlug) });
  if (!from) { console.log(`  образец «${fromSlug}» не найден — прайс пустой`); return; }
  const cats = await db.query.serviceCategories.findMany({
    where: eq(s.serviceCategories.salonId, from.id), orderBy: asc(s.serviceCategories.sortOrder),
    with: { services: true, addons: true },
  });
  for (const c of cats) {
    const [nc] = await db.insert(s.serviceCategories).values({
      salonId: toSalonId, hall: c.hall, name: c.name, note: c.note, byLength: c.byLength, forKids: c.forKids,
      journalGroup: c.journalGroup, sortOrder: c.sortOrder, active: c.active,
    }).returning();
    for (const v of c.services) {
      await db.insert(s.services).values({
        categoryId: nc.id, name: v.name, price: v.price, priceMax: v.priceMax, durationMin: v.durationMin, durationLabel: v.durationLabel,
        byLength: v.byLength, ageMin: v.ageMin, ageMax: v.ageMax, pauseAfterMin: v.pauseAfterMin, pauseMin: v.pauseMin,
        sortOrder: v.sortOrder, active: v.active,
      });
    }
    for (const a of c.addons) {
      await db.insert(s.addons).values({ categoryId: nc.id, name: a.name, price: a.price, durationMin: a.durationMin, rule: a.rule, sortOrder: a.sortOrder, active: a.active });
    }
  }
  console.log(`  прайс скопирован из «${fromSlug}»: разделов ${cats.length}`);
}

async function main() {
  for (const cfg of SALONS) {
    let salon = await db.query.salons.findFirst({ where: eq(s.salons.slug, cfg.slug) });
    if (!salon && cfg.create) {
      const c = cfg.create;
      [salon] = await db.insert(s.salons).values({
        slug: cfg.slug, name: c.name, tagline: c.tagline ?? 'Салон красоты', city: c.city, address: c.address, phone: c.phone,
        whatsapp: c.whatsapp, instagram: c.instagram, accentColor: c.accentColor ?? '#4E6B45',
        hoursText: c.hoursText ?? null, menHallNote: c.menHallNote ?? null, womenHallNote: c.womenHallNote ?? null,
        setupCodeHash: c.setupCodeHash,
      }).returning();
      console.log(`Создан салон «${c.name}» (/${cfg.slug})`);
      if (c.template) await copyCatalog(c.template, salon.id);
    }
    if (!salon) { console.log(`Салон /${cfg.slug} не найден и не описан для создания — пропуск`); continue; }
    const demoUntil = cfg.demoUntil ? new Date(cfg.demoUntil) : null;
    if ((salon.demoUntil?.getTime() ?? null) !== (demoUntil?.getTime() ?? null)) {
      await db.update(s.salons).set({ demoUntil }).where(eq(s.salons.id, salon.id));
      console.log(`/${cfg.slug}: демо-доступ ${demoUntil ? `до ${cfg.demoUntil}` : 'без ограничения'}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
