// Салоны, которые обслуживает приложение. Этот файл применяется при каждой публикации (npm run vercel-build):
// — нового салона ещё нет в базе → он создаётся (с прайсом, скопированным из салона-образца, если указан template);
// — demoUntil всегда берётся отсюда: так продлевается или отключается демо-доступ (null — без ограничения).
// Остальное (мастера, фото, цены, графики, тексты, PIN) салон меняет сам в «Настройках».
//
// Новый салон: npx tsx src/db/setup-code.ts — выдаст код первичной настройки и его хеш.
// Хеш — сюда (setupCodeHash), сам код — владельцу салона: с ним на /<slug>/admin он задаст PIN администратора.

export type SalonConfig = {
  slug: string;
  demoUntil: string | null;
  /** Только для создания нового салона */
  create?: {
    name: string; tagline?: string; city?: string; address?: string; phone?: string; whatsapp?: string; instagram?: string;
    accentColor?: string; hoursText?: string; menHallNote?: string; womenHallNote?: string;
    setupCodeHash: string;
    /** Скопировать разделы и услуги (с ценами) из этого салона — потом поправить в «Настройках» */
    template?: string;
  };
};

export const SALONS: SalonConfig[] = [
  { slug: 'vesna', demoUntil: '2026-10-27T22:00:00+06:00' },
];
