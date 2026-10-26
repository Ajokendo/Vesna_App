import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAdmin } from '@/server/admin-auth';
import { CategoryInput, SalonSettings, ServiceInput, saveCategory, saveService, saveStaff, StaffInput, updateSalonSettings } from '@/server/manage';

const Body = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('salon'), data: SalonSettings }),
  z.object({ kind: z.literal('service'), data: ServiceInput }),
  z.object({ kind: z.literal('category'), data: CategoryInput }),
  z.object({ kind: z.literal('staff'), data: StaffInput }),
]);

const LABEL: Record<string, string> = {
  name: 'Название', accentColor: 'Цвет', hoursText: 'Часы работы', mapUrl: 'Ссылка на 2ГИС (должна начинаться с https://)', menHallNote: 'Мужской зал', womenHallNote: 'Женский зал', logo: 'Логотип', tagline: 'Описание', city: 'Город', address: 'Адрес', phone: 'Телефон', whatsapp: 'WhatsApp', instagram: 'Instagram',
  bookingHorizonDays: 'На сколько дней вперёд запись', minLeadMinutes: 'Минимум до записи', pointsPercent: 'Процент баллов',
  defaultCommission: 'Доля мастера', lateCallMinutes: 'Звонить через', noShowMinutes: '«Не пришёл» через',
  price: 'Цена', priceMax: 'Цена «до»', durationMin: 'Длительность (от 5 до 600 мин)', dur: 'Минут', durationLabel: 'Как писать время',
  pauseAfterMin: 'Выдержка с', pauseMin: 'Выдержка', pa: 'Выдержка с', pm: 'Выдержка', max: 'Цена «до»',
  ageMin: 'Возраст от', commission: 'Доля мастера', photo: 'Фото', startMinute: 'Начало дня', endMinute: 'Конец дня', breakStart: 'Перерыв с', breakEnd: 'Перерыв до', cycleStart: 'Первый рабочий день', cycleWork: 'Дней работы', cycleOff: 'Дней отдыха', weekdays: 'Рабочие дни', ageMax: 'Возраст до', note: 'Пояснение',
};

/** Сохранить настройки салона, услугу или раздел */
export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  if (!(await isAdmin((await ctx.params).salon))) return NextResponse.json({ error: 'Нужен вход для сотрудников' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return NextResponse.json({ error: `Проверьте поле «${(() => { const k = String(i?.path.at(-1) ?? ''); return LABEL[k] ?? k; })()}»` }, { status: 400 });
  }
  const { salon } = await ctx.params;
  try {
    const b = parsed.data;
    if (b.kind === 'salon') { await updateSalonSettings(salon, b.data); return NextResponse.json({ ok: true }); }
    if (b.kind === 'service') return NextResponse.json(await saveService(salon, b.data));
    if (b.kind === 'staff') return NextResponse.json(await saveStaff(salon, b.data));
    return NextResponse.json(await saveCategory(salon, b.data));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
