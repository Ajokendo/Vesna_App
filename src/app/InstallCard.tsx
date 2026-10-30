'use client';

import { useEffect, useState } from 'react';
import { isStandalone } from './AppBonus';
import { useT } from './Lang';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** «Установите приложение — получите N баллов»: кнопка для Android, подсказка для iPhone. В установленном приложении не показывается */
export default function InstallCard({ bonus, compact }: { bonus: number; compact?: boolean }) {
  const t = useT();
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    setShow(true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    window.addEventListener('beforeinstallprompt', h);
    window.addEventListener('appinstalled', () => setDone(true));
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  if (!show) return null;
  if (done) {
    return <div className="card small" style={{ borderColor: 'var(--gold)' }}>{bonus ? t('Готово! Откройте приложение салона с экрана телефона — там вас ждут {n} баллов.', { n: bonus }) : t('Готово! Откройте приложение салона с экрана телефона.')}</div>;
  }
  return (
    <section className="card stack" style={{ gap: 8, borderColor: 'var(--gold)', background: 'linear-gradient(160deg,#fff,#f7f1e3)' }}>
      <strong style={{ fontSize: compact ? 15 : 17 }}>📲 {t('Установите приложение')}{bonus ? <> — <span style={{ color: 'var(--accent-dark)' }}>{t('{n} баллов в подарок', { n: bonus })}</span></> : ''}</strong>
      {!compact && <span className="small muted" style={{ lineHeight: 1.45 }}>{t('Значок салона на экране телефона: запись в пару касаний, напоминания о визите и баллы всегда под рукой.')}</span>}
      {evt ? (
        <button type="button" className="btn primary" onClick={async () => { await evt.prompt(); const c = await evt.userChoice; if (c.outcome === 'accepted') setDone(true); }}>{t('Установить')}</button>
      ) : ios ? (
        <span className="small" style={{ lineHeight: 1.5 }}>{t('В Safari нажмите «Поделиться» (квадрат со стрелкой) → «На экран Домой». Затем откройте приложение со значка.')}{bonus ? ' ' + t('Баллы начислятся сразу.') : ''}<br /><span className="muted">{t('Safari есть на каждом iPhone — найдите его через поиск. В Chrome (iOS 16.4 и новее) так же: «Поделиться» → «На экран Домой».')}</span></span>
      ) : (
        <span className="small" style={{ lineHeight: 1.5 }}>{t('В Chrome откройте меню ⋮ → «Добавить на главный экран» (или «Установить приложение»). Затем откройте приложение со значка.')}{bonus ? ' ' + t('Баллы начислятся сразу.') : ''}</span>
      )}
    </section>
  );
}
