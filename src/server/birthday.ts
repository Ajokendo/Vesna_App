import 'server-only';
import { and, eq, gte, inArray, isNotNull, or, isNull, ne, sql } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { sendToClients } from './push';
import { utcToZoned } from '@/lib/time';
import { getMe } from './me';

// Поздравление с днём рождения: утром (с 09:00 по времени салона) клиенту приходит push,
// и, если салон дарит баллы, они начисляются на счёт. Детей поздравляем через родителя — баллы родителю.
// Родившихся 29 февраля в невисокосный год поздравляем 28-го. Каждого — один раз в год.
// Баллы дарим только тем, кто был в салоне (оплаченный визит — сам или его ребёнок) за последние 12 месяцев:
// иначе можно годами копить подарки, не приходя, и прийти «бесплатно». Остальным — поздравление и приглашение.

const FROM_MINUTE = 9 * 60;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Чьи дни рождения сегодня: месяц-день; 28 февраля в невисокосный год — ещё и 29-е */
export function birthdayKeys(date: string): string[] {
  const md = date.slice(5);
  const y = Number(date.slice(0, 4));
  return md === '02-28' && !isLeap(y) ? ['02-28', '02-29'] : [md];
}

export async function runBirthdays(now = new Date()) {
  const salons = await db.query.salons.findMany({ where: eq(s.salons.birthdayGreet, true) });
  let greeted = 0;
  for (const salon of salons) {
    const local = utcToZoned(now, salon.timezone);
    if (local.minute < FROM_MINUTE) continue;
    const year = Number(local.date.slice(0, 4));
    const keys = birthdayKeys(local.date);
    const due = await db.select().from(s.clients).where(and(
      eq(s.clients.salonId, salon.id), isNotNull(s.clients.birthDate),
      sql`to_char(${s.clients.birthDate}, 'MM-DD') in (${sql.join(keys.map((k) => sql`${k}`), sql`, `)})`,
      or(isNull(s.clients.birthdayGiftYear), ne(s.clients.birthdayGiftYear, year)),
    ));
    for (const c of due) {
      // отметить «поздравлен в этом году» — если параллельный вызов уже отметил, пропускаем
      const [mark] = await db.update(s.clients).set({ birthdayGiftYear: year })
        .where(and(eq(s.clients.id, c.id), or(isNull(s.clients.birthdayGiftYear), ne(s.clients.birthdayGiftYear, year)))).returning({ id: s.clients.id });
      if (!mark) continue;
      const payerId = c.guardianId ?? c.id;
      const child = !!c.guardianId;
      // был ли в салоне за последний год (сам плательщик или кто-то из его семьи)
      const family = (await db.select({ id: s.clients.id }).from(s.clients).where(or(eq(s.clients.id, payerId), eq(s.clients.guardianId, payerId)))).map((x) => x.id);
      const yearAgo = new Date(now.getTime() - 365 * 864e5);
      const [visit] = await db.select({ id: s.appointments.id }).from(s.appointments)
        .where(and(inArray(s.appointments.clientId, family), eq(s.appointments.paid, true), gte(s.appointments.startsAt, yearAgo))).limit(1);
      const gift = salon.birthdayBonus > 0 && !!visit ? salon.birthdayBonus : 0;
      if (gift > 0) {
        await db.transaction(async (tx) => {
          const [p] = await tx.update(s.clients).set({ points: sql`${s.clients.points} + ${gift}` }).where(eq(s.clients.id, payerId)).returning({ points: s.clients.points });
          await tx.insert(s.pointsLedger).values({
            salonId: salon.id, clientId: payerId, kind: 'ADJUST', delta: gift, balanceAfter: p.points,
            note: child ? `Подарок на день рождения: ${c.name}` : 'Подарок на день рождения',
          });
        });
      }
      const payer = child ? await db.query.clients.findFirst({ where: eq(s.clients.id, payerId) }) : c;
      if (payer?.promoOptOut) { greeted++; continue; }
      const giftText = gift > 0 ? ` Дарим ${gift} баллов — 1 балл = 1 сом.` : '';
      await sendToClients([payerId], {
        title: child ? `🎂 ${c.name} — с днём рождения!` : `🎂 ${c.name.split(' ')[0]}, с днём рождения!`,
        body: `Салон «${salon.name}» поздравляет${child ? ` ${c.name}` : ' вас'}!${giftText} Ждём в гости.`,
        url: `/${salon.slug}/points`,
        tag: `birthday-${c.id}-${year}`,
      }).catch((e) => console.error('birthday push', (e as Error).message));
      greeted++;
    }
  }
  return { birthdays: greeted };
}

/** Клиент сам указывает день рождения (только если ещё не указан — менять может администратор) */
export async function setMyBirthday(slug: string, date: string) {
  const me = await getMe(slug);
  if (!me) throw new Error('Сначала запишитесь — тогда приложение вас узнает');
  if (me.client.birthDate) throw new Error('День рождения уже указан. Если ошиблись — скажите администратору');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Укажите дату');
  const y = Number(date.slice(0, 4));
  const nowY = new Date().getFullYear();
  if (y < nowY - 100 || y > nowY - 3) throw new Error('Проверьте год рождения');
  // если день рождения сегодня — подарок в этом году уже не положен (чтобы не указывать «сегодня» ради баллов)
  const today = utcToZoned(new Date(), me.salon.timezone).date;
  const thisYear = birthdayKeys(today).includes(date.slice(5)) ? Number(today.slice(0, 4)) : null;
  await db.update(s.clients).set({ birthDate: date, ...(thisYear ? { birthdayGiftYear: thisYear } : {}) }).where(eq(s.clients.id, me.client.id));
}
