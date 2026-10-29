'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatSom, plural } from '@/lib/pricing';
import { useLang, useT } from '@/app/Lang';
import { scheduleIn } from '@/lib/i18n';

export type MasterInfo = {
  id: string; name: string; title: string | null; photoUrl: string | null; scheduleLabel: string;
  rating: { avg: number; count: number } | null;
  /** Услуги мастера по разделам: название и цена «от» */
  groups: { name: string; services: { name: string; from: number; ranged: boolean }[] }[];
};

/**
 * «Наши мастера» на главной: нажали на мастера — открывается его карточка с крупным фото и услугами,
 * внизу «Записаться к …» — запись сразу к этому мастеру (дальше только услуга, день и время).
 */
export default function MasterCards({ slug, masters }: { slug: string; masters: MasterInfo[] }) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState<MasterInfo | null>(null);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  return (
    <>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {masters.map((m) => (
          <button key={m.id} type="button" className="card press" onClick={() => setOpen(m)} aria-label={`${m.name} — ${t('услуги и запись')}`}
            style={{ flex: '0 0 120px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 8px', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
            <span className="avatar" style={{ width: 'clamp(60px, 9dvh, 88px)', height: 'clamp(60px, 9dvh, 88px)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.photoUrl ? <img src={m.photoUrl} alt="" /> : m.name[0]}
            </span>
            <strong>{m.name}</strong>
            <span className="small muted" style={{ lineHeight: 1.25, fontSize: 13 }}>{m.title ? t(m.title).split(',')[0] : null}</span>
            {m.rating && <span className="small" style={{ color: '#B7860F', fontWeight: 800, fontSize: 12 }}>★ {m.rating.avg.toFixed(1).replace('.', ',')} ({m.rating.count})</span>}
          </button>
        ))}
      </div>

      {open && (
        <div role="dialog" aria-modal="true" aria-label={`${t('Мастер')} ${open.name}`} onClick={() => setOpen(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(23,35,28,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fadeIn .15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} className="stack"
            style={{ position: 'relative', width: '100%', maxWidth: 480, maxHeight: '92dvh', background: 'var(--ground, #F6F6F1)', borderRadius: '24px 24px 0 0', padding: '18px 20px calc(16px + env(safe-area-inset-bottom))', gap: 14, animation: 'sheetUp .22s ease' }}>
            <button type="button" onClick={() => setOpen(null)} aria-label={t('Закрыть')}
              style={{ position: 'absolute', top: 12, right: 14, zIndex: 1, width: 40, height: 40, borderRadius: '50%', border: 0, background: '#fff', fontSize: 22, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>×</button>
            <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 6 }}>
              <span className="avatar" style={{ width: 'min(46vw, 24dvh, 190px)', height: 'min(46vw, 24dvh, 190px)', fontSize: 56, boxShadow: '0 0 0 4px #fff, 0 0 0 5.5px var(--gold)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {open.photoUrl ? <img src={open.photoUrl} alt={open.name} /> : open.name[0]}
              </span>
              <h2 style={{ fontSize: 24, margin: '6px 0 0' }}>{open.name}</h2>
              {open.title && <span className="muted" style={{ lineHeight: 1.35 }}>{t(open.title)}</span>}
              {open.rating && <span style={{ color: '#B7860F', fontWeight: 800 }}>★ {open.rating.avg.toFixed(1).replace('.', ',')} · {open.rating.count} {t(plural(open.rating.count, 'оценка', 'оценки', 'оценок'))}</span>}
              {open.scheduleLabel && <span className="small muted">{scheduleIn(lang, open.scheduleLabel)}</span>}
            </div>

            <div className="stack" style={{ gap: 10, overflowY: 'auto', overscrollBehavior: 'contain', minHeight: 0, flex: '1 1 auto' }}>
              {open.groups.map((g) => (
                <section key={g.name} className="card stack" style={{ gap: 4, padding: '10px 14px' }}>
                  <strong style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{g.name}</strong>
                  {g.services.map((v) => (
                    <div key={v.name} className="row" style={{ justifyContent: 'space-between', gap: 10, fontSize: 14 }}>
                      <span style={{ minWidth: 0 }}>{t(v.name)}</span>
                      <span style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{v.ranged ? t('от') + ' ' : ''}{formatSom(v.from)}</span>
                    </div>
                  ))}
                </section>
              ))}
            </div>

            <Link href={`/${slug}/book?staff=${open.id}`} className="btn primary block" style={{ minHeight: 52, fontSize: 17, flex: '0 0 auto' }}>
              {t('Записаться к мастеру {name}', { name: open.name })}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
