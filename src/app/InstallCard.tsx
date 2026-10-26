'use client';

import { useEffect, useState } from 'react';
import { isStandalone } from './AppBonus';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** «Установите приложение — получите N баллов»: кнопка для Android, подсказка для iPhone. В установленном приложении не показывается */
export default function InstallCard({ bonus, compact }: { bonus: number; compact?: boolean }) {
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
    return <div className="card small" style={{ borderColor: 'var(--gold)' }}>Готово! Откройте приложение салона с экрана телефона{bonus ? ` — там вас ждут ${bonus} баллов` : ''}.</div>;
  }
  return (
    <section className="card stack" style={{ gap: 8, borderColor: 'var(--gold)', background: 'linear-gradient(160deg,#fff,#f7f1e3)' }}>
      <strong style={{ fontSize: compact ? 15 : 17 }}>📲 Установите приложение{bonus ? <> — <span style={{ color: 'var(--accent-dark)' }}>{bonus} баллов в подарок</span></> : ''}</strong>
      {!compact && <span className="small muted" style={{ lineHeight: 1.45 }}>Значок салона на экране телефона: запись в пару касаний, напоминания о визите и баллы всегда под рукой.</span>}
      {evt ? (
        <button type="button" className="btn primary" onClick={async () => { await evt.prompt(); const c = await evt.userChoice; if (c.outcome === 'accepted') setDone(true); }}>Установить</button>
      ) : ios ? (
        <span className="small" style={{ lineHeight: 1.5 }}>В Safari нажмите <b>«Поделиться»</b> (квадрат со стрелкой) → <b>«На экран Домой»</b>. Затем откройте приложение со значка{bonus ? ' — баллы начислятся сразу' : ''}.</span>
      ) : (
        <span className="small" style={{ lineHeight: 1.5 }}>В Chrome откройте меню <b>⋮</b> → <b>«Добавить на главный экран»</b> (или «Установить приложение»). Затем откройте приложение со значка{bonus ? ' — баллы начислятся сразу' : ''}.</span>
      )}
    </section>
  );
}
