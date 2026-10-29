'use client';

import { useEffect, useState } from 'react';
import { useT } from './Lang';

type Card = { icon: string; title: string; text: string };

/**
 * Знакомство с приложением для клиента: несколько карточек при первом открытии (листаются пальцем или кнопкой).
 * Показывается один раз; снова — из «Ещё → Как пользоваться приложением» (?intro=1).
 */
export default function Intro({ slug, salonName, percent, minRedeem, welcomeBonus, referralBonus }: {
  slug: string; salonName: string; percent: number; minRedeem: number; welcomeBonus: number; referralBonus: number;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const key = `intro_${slug}`;
  useEffect(() => {
    const force = new URLSearchParams(location.search).get('intro') === '1';
    let seen = false;
    try { seen = localStorage.getItem(key) === '1'; } catch { /* приватный режим */ }
    if (force || !seen) setOpen(true);
  }, [key]);
  const cards: Card[] = [
    { icon: '🗓️', title: t('Запись в пару касаний'), text: t('Выберите услугу, мастера и свободное время — без звонков. Видно только то время, когда мастер действительно свободен.') },
    { icon: '🔔', title: t('Напомним о визите'), text: t('Утром в день визита и за час до него придёт напоминание. Если планы изменились — нажмите «Опоздаю» или «Не смогу прийти».') },
    { icon: '⭐', title: t('Копите баллы — {p}% с визита', { p: percent }), text: minRedeem > 0 ? t('1 балл = 1 сом. Когда накопится {n} баллов, ими можно оплатить услугу целиком или частично. Баланс — в разделе «Баллы».', { n: minRedeem }) : t('1 балл = 1 сом. Ими можно оплатить услугу целиком или частично. Баланс — в разделе «Баллы».') },
    ...(welcomeBonus > 0 ? [{ icon: '🎁', title: t('{n} баллов за установку', { n: welcomeBonus }), text: t('Добавьте приложение на экран телефона и откройте его со значка — баллы начислятся сразу.') }] : []),
    ...(referralBonus > 0 ? [{ icon: '🤝', title: t('Приглашайте друзей — {n} баллов', { n: referralBonus }), text: t('Отправьте другу свою ссылку из раздела «Баллы». Когда он впервые придёт и оплатит визит, вам начислятся баллы.') }] : []),
  ];
  function close() {
    try { localStorage.setItem(key, '1'); } catch { /* ничего */ }
    setOpen(false); setI(0);
    if (location.search.includes('intro=1')) history.replaceState(null, '', location.pathname);
  }
  if (!open) return null;
  const c = cards[i];
  const last = i === cards.length - 1;
  let startX = 0;
  return (
    <div role="dialog" aria-modal="true" aria-label={`${t('Знакомство с приложением')} «${salonName}»`} style={{
      position: 'fixed', inset: 0, zIndex: 85, background: 'rgba(23,35,28,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="card stack" onTouchStart={(e) => { startX = e.touches[0].clientX; }}
        onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - startX; if (dx < -40 && !last) setI(i + 1); if (dx > 40 && i > 0) setI(i - 1); }}
        style={{ width: '100%', maxWidth: 380, textAlign: 'center', gap: 12, padding: '28px 22px 20px', borderColor: 'var(--gold)' }}>
        <div style={{ fontSize: 56, lineHeight: 1 }} aria-hidden>{c.icon}</div>
        <strong style={{ fontFamily: 'var(--serif)', fontSize: 24, lineHeight: 1.2 }}>{c.title}</strong>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5, minHeight: 96 }}>{c.text}</p>
        <div className="row" style={{ justifyContent: 'center', gap: 6 }} aria-hidden>
          {cards.map((_, k) => <span key={k} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 99, background: k === i ? 'var(--accent)' : 'var(--line)', transition: 'width .2s' }} />)}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {!last && <button type="button" className="btn" style={{ flex: 1 }} onClick={close}>{t('Пропустить')}</button>}
          <button type="button" className="btn primary" style={{ flex: 2 }} onClick={() => (last ? close() : setI(i + 1))}>{last ? t('Понятно, начнём!') : t('Далее')}</button>
        </div>
      </div>
    </div>
  );
}
