'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect } from 'react';
import { makeT, type Lang } from '@/lib/i18n';

const Ctx = createContext<Lang>('ru');

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
export const useT = () => makeT(useContext(Ctx));

/** Переключатель «Кыргызча | Русский»: запоминается на телефоне на год */
export function LangSwitch({ compact }: { compact?: boolean }) {
  const lang = useLang();
  const router = useRouter();
  const set = (l: Lang) => {
    if (l === lang) return;
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  const items: [Lang, string][] = compact ? [['ky', 'КЫР'], ['ru', 'РУС']] : [['ky', 'Кыргызча'], ['ru', 'Русский']];
  return (
    <div className="tabs" role="group" aria-label="Тил / Язык" style={compact ? { padding: 3, gap: 2 } : undefined}>
      {items.map(([l, label]) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => set(l)}
          style={compact ? { minHeight: 30, padding: '0 9px', fontSize: 12 } : undefined}>{label}</button>
      ))}
    </div>
  );
}
