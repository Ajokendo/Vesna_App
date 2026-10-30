'use client';

import { useEffect, useState } from 'react';

type Card = { icon: string; title: string; text: string };

const CARDS: Record<'admin' | 'master' | 'owner', Card[]> = {
  admin: [
    { icon: '📅', title: 'Это журнал записей', text: 'Колонки — мастера, вверху дни недели. Онлайн-записи клиентов появляются здесь сами, журнал обновляется каждую минуту.' },
    { icon: '👆', title: 'Нажмите на запись', text: 'Там всё: «Пришёл», оплата с баллами и сертификатом, перенос, время окончания, отмена.' },
    { icon: '🎨', title: 'Цвета подскажут', text: 'Оранжевая запись — клиент опаздывает, позвоните. Красная — не пришёл. 💳 — ждём предоплату. Все обозначения — внизу журнала.' },
    { icon: 'ℹ️', title: 'Значок «i» — подсказка', text: 'Рядом с непонятными кнопками есть «i»: нажмите — короткое пояснение. Полная инструкция — кнопка «❓ Инструкция».' },
  ],
  master: [
    { icon: '✂', title: 'Ваш кабинет', text: 'Здесь только ваши записи на день. Вверху — дни недели: нажмите, чтобы посмотреть другой день.' },
    { icon: '⏱', title: 'Задерживаетесь?', text: '«Закончу раньше / задержусь» — поправьте время окончания, следующий клиент не наложится.' },
    { icon: '💰', title: 'Ваш заработок', text: 'Внизу — сколько вы заработали за день. Значок «i» объясняет, как считается доля.' },
  ],
  owner: [
    { icon: '📊', title: 'Кабинет директора', text: 'Видите только вы: администратор сюда не попадёт. Внизу разделы: выручка, зарплата, мастера, расходы.' },
    { icon: '📅', title: 'Выберите период', text: 'День, неделя, месяц или год — каждая цифра сравнивается с прошлым таким же периодом.' },
    { icon: '🧾', title: 'Зарплата и прибыль', text: '«Зарплата» — сколько каждому мастеру, с выгрузкой в Excel. «Расходы» — внесите аренду и материалы, прибыль посчитается сама.' },
  ],
};

/** Знакомство при первом входе сотрудника: несколько карточек, показывается один раз на телефоне */
export default function StaffIntro({ slug, role }: { slug: string; role: 'admin' | 'master' | 'owner' }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const key = `intro_${role}_${slug}`;
  useEffect(() => { try { if (localStorage.getItem(key) !== '1') setOpen(true); } catch { /* приватный режим */ } }, [key]);
  if (!open) return null;
  const cards = CARDS[role];
  const c = cards[i];
  const last = i === cards.length - 1;
  const close = () => { try { localStorage.setItem(key, '1'); } catch { /* ничего */ } setOpen(false); };
  return (
    <div role="dialog" aria-modal="true" aria-label="Как здесь всё устроено" style={{ position: 'fixed', inset: 0, zIndex: 85, background: 'rgba(23,35,28,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card stack" style={{ width: '100%', maxWidth: 400, textAlign: 'center', gap: 12, padding: '26px 22px 18px', borderColor: 'var(--gold)' }}>
        <div style={{ fontSize: 50, lineHeight: 1 }} aria-hidden>{c.icon}</div>
        <strong style={{ fontFamily: 'var(--serif)', fontSize: 22, lineHeight: 1.2 }}>{c.title}</strong>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5, minHeight: 72 }}>{c.text}</p>
        <div className="row" style={{ justifyContent: 'center', gap: 6 }} aria-hidden>
          {cards.map((_, k) => <span key={k} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 99, background: k === i ? 'var(--accent)' : 'var(--line)' }} />)}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {last ? <a href={`/${slug}/help?r=${role}`} className="btn" style={{ flex: 1 }} onClick={close}>❓ Инструкция</a>
            : <button type="button" className="btn" style={{ flex: 1 }} onClick={close}>Пропустить</button>}
          <button type="button" className="btn primary" style={{ flex: 2 }} onClick={() => (last ? close() : setI(i + 1))}>{last ? 'Понятно' : 'Далее'}</button>
        </div>
      </div>
    </div>
  );
}
