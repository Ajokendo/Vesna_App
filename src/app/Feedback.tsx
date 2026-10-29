'use client';

import { useState } from 'react';
import { useT } from './Lang';

/** «Написать разработчикам»: строка-кнопка и форма. Сообщение уходит разработчикам, салон его не видит */
export default function Feedback({ salon, role, children }: { salon: string; role: 'CLIENT' | 'MASTER' | 'ADMIN'; children?: React.ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [contact, setContact] = useState('');
  const [device, setDevice] = useState(true);
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  async function send() {
    setState('busy'); setError(null);
    const r = await fetch('/api/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        salon, role, text, contact: contact || null, page: location.pathname,
        device: device ? `${navigator.userAgent} · экран ${screen.width}×${screen.height} · ${matchMedia('(display-mode: standalone)').matches ? 'установлено' : 'в браузере'}` : null,
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error ?? t('Не получилось отправить')); setState('idle'); return; }
    setState('sent');
  }
  const inp = { width: '100%', borderRadius: 12, border: '1px solid #dde5de', padding: '10px 12px', fontSize: 15, fontFamily: 'inherit', background: '#fff' } as const;
  return (
    <>
      <span onClick={() => setOpen(true)} style={{ cursor: 'pointer', display: 'block' }}>{children ?? <button type="button" className="btn">{t('Написать разработчикам')}</button>}</span>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={t('Сообщение разработчикам')} onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(23,35,28,.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div className="card stack" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, gap: 12, borderRadius: '20px 20px 0 0', paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}>
            {state === 'sent' ? (
              <>
                <strong style={{ fontSize: 18 }}>{t('Спасибо! Сообщение отправлено')}</strong>
                <span className="muted" style={{ lineHeight: 1.5 }}>{t('Разработчики прочитают его и, если вы оставили контакт, ответят. Если вопрос о записи — быстрее написать в салон.')}</span>
                <button type="button" className="btn primary" onClick={() => { setOpen(false); setState('idle'); setText(''); setContact(''); }}>{t('Закрыть')}</button>
              </>
            ) : (
              <>
                <strong style={{ fontSize: 18 }}>{t('Написать разработчикам')}</strong>
                <span className="small muted" style={{ lineHeight: 1.45 }}>{t('Что-то не работает или есть идея, как сделать приложение удобнее? Сообщение получат разработчики приложения, салон его не видит.')}</span>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={t('Что случилось или что предлагаете')} style={{ ...inp, resize: 'vertical' }} autoFocus />
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t('Куда ответить (WhatsApp или e-mail) — по желанию')} style={inp} />
                <label className="row small" style={{ gap: 8 }}><input type="checkbox" checked={device} onChange={(e) => setDevice(e.target.checked)} /> {t('Приложить сведения о телефоне (помогает найти ошибку)')}</label>
                {error && <div className="error" role="alert">{error}</div>}
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn" onClick={() => setOpen(false)}>{t('Отмена')}</button>
                  <button type="button" className="btn primary grow" disabled={state === 'busy' || text.trim().length < 3} onClick={send}>{state === 'busy' ? t('Отправляем…') : t('Отправить')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
