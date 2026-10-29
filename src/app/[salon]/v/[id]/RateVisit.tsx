'use client';

import { useState } from 'react';
import { useT } from '@/app/Lang';

/** Оценка визита: звёзды и пара слов. После 5 звёзд — предложение оставить отзыв в 2ГИС (с баллами, если салон их дарит) */
export default function RateVisit({ slug, id, token, master, done, mapUrl, bonus }: {
  slug: string; id: string; token: string; master: string; done: number | null; mapUrl: string | null; bonus: number;
}) {
  const t = useT();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [sent, setSent] = useState<number | null>(done);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    setBusy(true); setError(null);
    const r = await fetch(`/api/${slug}/visits/${id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token, stars, text: text || null }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error ?? t('Не получилось')); return; }
    setSent(stars);
  }
  if (sent) {
    return (
      <section className="card stack" style={{ gap: 8, textAlign: 'center', borderColor: 'var(--gold)' }}>
        <div style={{ fontSize: 26, color: '#E3A21A', letterSpacing: 2 }} aria-label={t('{a} из {b}', { a: sent, b: 5 })}>{'★'.repeat(sent)}<span style={{ color: '#d9dcd4' }}>{'★'.repeat(5 - sent)}</span></div>
        <strong>{t('Спасибо за оценку!')}</strong>
        {sent === 5 && mapUrl ? (
          <>
            <span className="small muted" style={{ lineHeight: 1.45 }}>
              {t('Рады, что вам понравилось! Расскажите о нас в 2ГИС — это очень помогает салону.')}
              {bonus > 0 ? <> {t('После проверки отзыва администратор начислит вам {n} баллов.', { n: bonus })}</> : null}
            </span>
            <a className="btn primary" href={mapUrl} target="_blank" rel="noreferrer"
              onClick={() => { fetch(`/api/${slug}/visits/${id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token, gis: true }) }).catch(() => {}); }}>
              📍 {t('Оставить отзыв в 2ГИС')}
            </a>
          </>
        ) : sent <= 3 ? <span className="small muted">{t('Нам жаль, что что-то пошло не так. Салон увидит вашу оценку и постарается всё исправить.')}</span> : null}
      </section>
    );
  }
  return (
    <section className="card stack" style={{ gap: 10, textAlign: 'center', borderColor: 'var(--gold)' }}>
      <strong style={{ fontSize: 17 }}>{t('Как вам визит к {name}?', { name: master })}</strong>
      <div className="row" style={{ justifyContent: 'center', gap: 4 }} role="radiogroup" aria-label={t('Оценка')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={t('{a} из {b}', { a: n, b: 5 })} onClick={() => setStars(n)}
            style={{ border: 0, background: 'none', fontSize: 38, lineHeight: 1, cursor: 'pointer', color: n <= stars ? '#E3A21A' : '#d9dcd4', padding: 2 }}>★</button>
        ))}
      </div>
      {stars > 0 && (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
            placeholder={stars >= 4 ? t('Что понравилось? (по желанию)') : t('Что было не так? Салон увидит и постарается исправить')}
            style={{ width: '100%', borderRadius: 12, border: '1px solid #dde5de', padding: '10px 12px', fontSize: 15, fontFamily: 'inherit' }} />
          {error && <div className="error" role="alert">{error}</div>}
          <button type="button" className="btn primary" disabled={busy} onClick={send}>{busy ? t('Отправляем…') : t('Отправить оценку')}</button>
        </>
      )}
    </section>
  );
}
