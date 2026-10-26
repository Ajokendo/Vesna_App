'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { hhmm } from '@/lib/time';
import { formatPrice, formatSom } from '@/lib/pricing';
import { calcPayment } from '@/lib/payment';

export type ApptItem = {
  id: string; start: number; end: number; client: string; service: string; addons: string[];
  price: number; priceMax: number | null; source: string; paid: boolean;
  pause: { after: number; min: number } | null;
  phone: string | null; balance: number; payer: string;
  payment: { finalPrice: number; pointsUsed: number; cash: number; pointsEarned: number; method: string | null; masterShare: number } | null;
  /** Мастер не выйдет в это время */
  conflict?: boolean;
  confirmed?: boolean;
  push?: boolean;
};

const METHODS = [
  { id: 'CASH', name: 'Наличные' }, { id: 'CARD', name: 'Карта' }, { id: 'QR', name: 'QR / банк' },
] as const;
const METHOD_NAME: Record<string, string> = { CASH: 'наличными', CARD: 'картой', QR: 'по QR', POINTS: 'баллами' };

/** Запись в колонке мастера. Окрашивание с выдержкой рисуется двумя частями: в выдержку мастер свободен */
export default function ApptCard({ a, top, px, slug, earnPercent, masterPercent }: {
  a: ApptItem; top: number; px: number; slug: string; earnPercent: number; masterPercent: number;
}) {
  const [open, setOpen] = useState(false);
  const walk = a.source === 'WALK_IN';
  const look = {
    background: a.paid ? 'var(--accent-soft)' : walk ? 'var(--cream)' : '#fff',
    border: a.conflict ? '2px solid var(--danger)' : `1px solid ${a.paid ? '#a9bc9c' : walk ? 'var(--gold)' : '#b9c7bc'}`,
  };
  const box = (from: number, to: number, children: React.ReactNode, key: string) => {
    const h = (to - from) * px;
    return (
      <button key={key} type="button" onClick={() => setOpen(true)} title={`${hhmm(a.start)}–${hhmm(a.end)} ${a.client}: ${a.service}`} style={{
        position: 'absolute', left: 6, right: 6, top: top + (from - a.start) * px + 1, height: h - 2, borderRadius: 10,
        padding: h >= 34 ? '5px 10px' : '2px 10px', overflow: 'hidden', fontSize: 12, textAlign: 'left', cursor: 'pointer',
        font: 'inherit', color: 'var(--ink)', ...look,
      }}>{children}</button>
    );
  };
  const title = (
    <>
      <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>
        {a.conflict ? '⚠ ' : a.paid ? '✓ ' : ''}{hhmm(a.start)} {a.client}{!a.paid && a.confirmed ? ' · подтвердил' : ''}{a.push ? ' 🔔' : ''}
      </div>
      {(a.pause ? a.pause.after : a.end - a.start) * px >= 34 && (
        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>
          {a.service}{a.addons.length ? ` + ${a.addons.join(', ').toLowerCase()}` : ''} · {a.payment ? formatSom(a.payment.finalPrice) : formatPrice(a.price, a.priceMax)}
        </div>
      )}
    </>
  );

  let parts: React.ReactNode[];
  if (a.pause) {
    const p0 = a.start + a.pause.after, p1 = p0 + a.pause.min;
    parts = [
      box(a.start, p0, title, 'a'),
      <div key="gap" aria-hidden="true" style={{
        position: 'absolute', left: 6, width: 4, top: top + (p0 - a.start) * px, height: (p1 - p0) * px,
        borderLeft: '3px dotted #a9bc9c',
      }} />,
      <div key="gapLabel" className="small" style={{
        position: 'absolute', left: 14, top: top + (p0 - a.start) * px + 2, fontSize: 10.5, fontWeight: 700, color: '#6f8467', pointerEvents: 'none',
      }}>выдержка {a.pause.min} мин — мастер свободен</div>,
      box(p1, a.end, <div style={{ fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hhmm(p1)} {a.client}: смывка, укладка</div>, 'b'),
    ];
  } else {
    parts = [box(a.start, a.end, title, 'a')];
  }

  return (
    <>
      {parts}
      {open && <PayDialog a={a} slug={slug} earnPercent={earnPercent} masterPercent={masterPercent} onClose={() => setOpen(false)} />}
    </>
  );
}

function PayDialog({ a, slug, earnPercent, masterPercent, onClose }: {
  a: ApptItem; slug: string; earnPercent: number; masterPercent: number; onClose: () => void;
}) {
  const router = useRouter();
  const isRange = a.priceMax != null && a.priceMax > a.price;
  const [price, setPrice] = useState(isRange ? '' : String(a.price));
  const [points, setPoints] = useState('0');
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'QR'>('CASH');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const priceN = Number(price);
  const pointsN = Number(points || 0);
  let calc: ReturnType<typeof calcPayment> | null = null;
  let calcError: string | null = null;
  if (price !== '') {
    try { calc = calcPayment({ price: priceN, points: pointsN, balance: a.balance, earnPercent, masterPercent }); }
    catch (e) { calcError = (e as Error).message; }
  }

  async function send(kind: 'pay' | 'cancel') {
    setBusy(true); setError(null);
    const res = kind === 'pay'
      ? await fetch(`/api/${slug}/admin/payments`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: a.id, price: priceN, points: pointsN, method: calc?.cash === 0 ? 'POINTS' : method }),
        })
      : await fetch(`/api/${slug}/admin/payments?appointmentId=${encodeURIComponent(a.id)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? 'Не получилось'); return; }
    onClose();
    router.refresh();
  }

  const maxPoints = Math.min(a.balance, priceN || 0);
  return (
    <div role="dialog" aria-modal="true" aria-label="Оплата" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(23,35,28,.35)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="card stack" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, gap: 14, maxHeight: '92dvh', overflowY: 'auto' }}>
        <div>
          <strong style={{ fontSize: 18 }}>{a.client}</strong>
          <div className="small muted">{a.service}{a.addons.length ? ` + ${a.addons.join(', ').toLowerCase()}` : ''}</div>
          {a.phone && <div className="small muted">{a.phone}</div>}
        </div>
        <EndTime a={a} slug={slug} />

        {a.payment ? (
          <>
            <div className="stack" style={{ gap: 6 }}>
              <Line label="Стоимость" value={formatSom(a.payment.finalPrice)} />
              {a.payment.pointsUsed > 0 && <Line label="Списано баллов" value={`−${a.payment.pointsUsed}`} />}
              <Line label={`Оплачено ${METHOD_NAME[a.payment.method ?? 'CASH'] ?? ''}`} value={formatSom(a.payment.cash)} strong />
              <Line label="Начислено баллов" value={`+${a.payment.pointsEarned}`} />
              <Line label="Мастеру" value={formatSom(a.payment.masterShare)} />
              <Line label={`Баллов у ${a.payer}`} value={String(a.balance)} />
            </div>
            {error && <div className="error" role="alert">{error}</div>}
            <div className="row">
              <button type="button" className="btn" onClick={onClose}>Закрыть</button>
              <button type="button" className="btn" disabled={busy} onClick={() => send('cancel')} style={{ color: 'var(--danger)' }}>Отменить оплату</button>
            </div>
          </>
        ) : (
          <>
            <label className="field">{isRange ? `Итоговая цена (${formatPrice(a.price, a.priceMax)})` : 'Цена, сом'}
              <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} placeholder="после консультации" />
            </label>

            <div className="stack" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small" style={{ fontWeight: 700 }}>Баллы{a.payer !== a.client ? ` (счёт: ${a.payer})` : ''}</span>
                <span className="small muted">на счёте: <strong style={{ color: 'var(--ink)' }}>{a.balance}</strong></span>
              </div>
              {a.balance > 0 ? (
                <div className="row">
                  <input aria-label="Сколько баллов списать" inputMode="numeric" value={points}
                    onChange={(e) => setPoints(e.target.value.replace(/\D/g, ''))}
                    style={{ minHeight: 48, borderRadius: 12, border: '1px solid #dde5de', padding: '0 14px', fontSize: 16, width: 110 }} />
                  <button type="button" className="btn" disabled={!maxPoints} onClick={() => setPoints(String(maxPoints))}>Все {maxPoints || ''}</button>
                  <button type="button" className="btn" onClick={() => setPoints('0')}>Без баллов</button>
                </div>
              ) : <span className="small muted">Баллов пока нет — начислим с этой оплаты.</span>}
            </div>

            {calc && calc.cash > 0 && (
              <div className="tabs" role="group" aria-label="Как оплачен остаток">
                {METHODS.map((m) => <button key={m.id} type="button" aria-pressed={method === m.id} onClick={() => setMethod(m.id)}>{m.name}</button>)}
              </div>
            )}

            {calc && (
              <div className="stack" style={{ gap: 6, background: 'var(--ground)', borderRadius: 14, padding: 12 }}>
                {calc.pointsUsed > 0 && <Line label="Баллами" value={`−${calc.pointsUsed}`} />}
                <Line label="К оплате деньгами" value={formatSom(calc.cash)} strong />
                <Line label={`Начислим баллов (${earnPercent}% от ${calc.cash})`} value={`+${calc.pointsEarned}`} />
                <Line label="Останется на счёте" value={String(calc.balanceAfter)} />
                <Line label={masterPercent ? `Мастеру (${masterPercent}%)` : 'Мастеру (хозяйка, без комиссии)'} value={formatSom(calc.masterShare)} />
              </div>
            )}
            {(calcError || error) && <div className="error" role="alert">{calcError || error}</div>}
            <div className="row">
              <button type="button" className="btn" onClick={onClose}>Отмена</button>
              <button type="button" className="btn primary grow" disabled={busy || !calc} onClick={() => send('pay')}>
                {busy ? 'Сохраняем…' : calc ? `Оплачено ${formatSom(calc.cash)}` : 'Оплачено'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', fontSize: strong ? 16 : 14, fontWeight: strong ? 800 : 500 }}>
      <span className={strong ? undefined : 'muted'}>{label}</span><span>{value}</span>
    </div>
  );
}

/** Мастер закончит раньше или задержится — меняем время окончания записи */
function EndTime({ a, slug }: { a: ApptItem; slug: string }) {
  const router = useRouter();
  const [end, setEnd] = useState(a.end);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const changed = end !== a.end;
  const shift = (d: number) => { setSaved(false); setError(null); setEnd((e) => Math.max(a.start + 5, Math.min(24 * 60, e + d))); };

  async function save() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/${slug}/admin/appointments/${a.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endMinute: end }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Не получилось'); return; }
    setSaved(true);
    router.refresh();
  }

  const small = { minHeight: 36, padding: '0 10px', fontSize: 13 } as const;
  return (
    <div className="stack" style={{ gap: 8, background: 'var(--ground)', borderRadius: 14, padding: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="small" style={{ fontWeight: 700 }}>Время</span>
        <span style={{ fontWeight: 800 }}>
          {hhmm(a.start)}–{hhmm(end)}
          <span className="small muted" style={{ fontWeight: 500 }}> · {end - a.start} мин{changed ? ` (было до ${hhmm(a.end)})` : ''}</span>
        </span>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <span className="small muted" style={{ marginRight: 2 }}>Окончание:</span>
        <button type="button" className="btn" style={small} onClick={() => shift(-15)}>−15</button>
        <button type="button" className="btn" style={small} onClick={() => shift(-5)}>−5</button>
        <button type="button" className="btn" style={small} onClick={() => shift(5)}>+5</button>
        <button type="button" className="btn" style={small} onClick={() => shift(15)}>+15</button>
        <input type="time" step={300} aria-label="Время окончания" value={hhmm(end)}
          onChange={(e) => { const [h, m] = e.target.value.split(':').map(Number); if (!Number.isNaN(h)) { setSaved(false); setEnd(h * 60 + m); } }}
          style={{ minHeight: 36, borderRadius: 10, border: '1px solid #dde5de', padding: '0 8px', fontSize: 14 }} />
      </div>
      {changed && !saved && (
        <button type="button" className="btn primary" style={{ minHeight: 40 }} disabled={busy} onClick={save}>
          {busy ? 'Сохраняем…' : end < a.end ? `Закончит в ${hhmm(end)} — освободить время` : `Закончит в ${hhmm(end)} — продлить`}
        </button>
      )}
      {saved && <span className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>✓ Сохранено — журнал и онлайн-запись обновились</span>}
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}
