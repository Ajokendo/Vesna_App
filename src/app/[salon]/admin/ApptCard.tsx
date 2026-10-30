'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { hhmm } from '@/lib/time';
import { formatPrice, formatSom } from '@/lib/pricing';
import { calcPayment } from '@/lib/payment';
import EndTimeEditor from '@/app/EndTimeEditor';
import { lateState, type LateState } from '@/lib/late';
import Link from 'next/link';
import { RescheduleButton } from './Reschedule';
import ConnectClient from './ConnectClient';

export type ApptItem = {
  id: string; start: number; end: number; date?: string; clientId?: string; visitToken?: string; client: string; service: string; addons: string[];
  price: number; priceMax: number | null; source: string; paid: boolean;
  pause: { after: number; min: number } | null;
  phone: string | null; balance: number; payer: string;
  payment: { finalPrice: number; pointsUsed: number; cash: number; pointsEarned: number; method: string | null; masterShare: number; cert: number } | null;
  /** Мастер не выйдет в это время */
  conflict?: boolean;
  confirmed?: boolean;
  push?: boolean;
  endChange?: { byMaster: boolean; planned: number } | null;
  arrived?: boolean;
  lateMinutes?: number | null;
  noShows?: number;
  /** Предоплата: сколько, до какого времени (минута дня), получена ли */
  prepay?: { amount: number; due: number | null; paid: boolean; prepaid: number } | null;
};

const METHODS = [
  { id: 'CASH', name: 'Наличные' }, { id: 'CARD', name: 'Карта' }, { id: 'QR', name: 'QR / банк' },
] as const;
const METHOD_NAME: Record<string, string> = { CASH: 'наличными', CARD: 'картой', QR: 'по QR', POINTS: 'баллами', CERT: 'сертификатом' };

/** Запись в колонке мастера. Окрашивание с выдержкой рисуется двумя частями: в выдержку мастер свободен */
export type LateRules = { certificates?: boolean; welcomeBonus?: number; minRedeem?: number; today?: string; nowMinute: number | null; callAfter: number; noShowAfter: number; salonName: string };

export default function ApptCard({ a, top, px, slug, earnPercent, masterPercent, rules }: {
  a: ApptItem; top: number; px: number; slug: string; earnPercent: number; masterPercent: number; rules: LateRules;
}) {
  const [open, setOpen] = useState(false);
  const walk = a.source === 'WALK_IN';
  const late = lateState({ start: a.start, nowMinute: rules.nowMinute, paid: a.paid, arrived: !!a.arrived, lateMinutes: a.lateMinutes ?? null, callAfter: rules.callAfter, noShowAfter: rules.noShowAfter });
  const look = {
    background: a.paid ? 'var(--accent-soft)' : late === 'noshow' ? '#fbebeb' : late === 'call' ? '#fdf1e2' : walk ? 'var(--cream)' : '#fff',
    border: a.conflict ? '2px solid var(--danger)' : late === 'noshow' ? '2px solid var(--danger)' : late === 'call' ? '2px solid #d98a2b'
      : a.endChange?.byMaster && !a.paid ? '2px solid var(--gold)' : `1px solid ${a.paid ? '#a9bc9c' : walk ? 'var(--gold)' : '#b9c7bc'}`,
  };
  const lateTag = late === 'noshow' ? ' · не пришёл?' : late === 'call' ? ' · опаздывает' : late === 'reported' ? ` · опоздает на ${a.lateMinutes}` : '';
  const box = (from: number, to: number, children: React.ReactNode, key: string) => {
    const h = (to - from) * px;
    return (
      <button key={key} type="button" onClick={() => setOpen(true)} title={`${hhmm(a.start)}–${hhmm(a.end)} ${a.client}: ${a.service}${a.endChange ? ` (окончание изменено, было ${hhmm(a.endChange.planned)}${a.endChange.byMaster ? ', отметил мастер' : ''})` : ''}`} style={{
        position: 'absolute', left: 6, right: 6, top: top + (from - a.start) * px + 1, height: h - 2, borderRadius: 10,
        padding: h >= 34 ? '5px 10px' : '2px 10px', overflow: 'hidden', fontSize: 12, textAlign: 'left', cursor: 'pointer',
        font: 'inherit', color: 'var(--ink)', ...look,
      }}>{children}</button>
    );
  };
  const title = (
    <>
      <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>
        {a.conflict ? '⚠ ' : a.paid ? '✓ ' : ''}{a.prepay && !a.prepay.paid && !a.paid ? '💳 ' : ''}{hhmm(a.start)} {a.client}{!a.paid && a.confirmed ? ' · подтвердил' : ''}{a.push ? ' 🔔' : ''}{a.endChange ? ` ⏱${a.endChange.byMaster ? ' мастер' : ''}` : ''}{a.arrived && !a.paid ? ' · в салоне' : ''}{lateTag}
      </div>
      {a.endChange && (a.end - a.start) * px >= 48 && (
        <div style={{ fontSize: 11, fontWeight: 800, color: '#7a5a1c' }}>
          ⏱ до {hhmm(a.end)} · было {hhmm(a.endChange.planned)}{a.endChange.byMaster ? ' · отметил мастер' : ''}
        </div>
      )}
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
      {open && <PayDialog a={a} slug={slug} earnPercent={earnPercent} masterPercent={masterPercent} rules={rules} late={late} onClose={() => setOpen(false)} />}
    </>
  );
}

function PayDialog({ a, slug, earnPercent, masterPercent, rules, late, onClose }: {
  a: ApptItem; slug: string; earnPercent: number; masterPercent: number; rules: LateRules; late: LateState; onClose: () => void;
}) {
  const router = useRouter();
  const isRange = a.priceMax != null && a.priceMax > a.price;
  const [price, setPrice] = useState(isRange ? '' : String(a.price));
  const [points, setPoints] = useState('0');
  const [method, setMethod] = useState<'CASH' | 'CARD' | 'QR'>('CASH');
  const [cert, setCert] = useState<CertInfo | null>(null);
  const [certSum, setCertSum] = useState('');
  const [materials, setMaterials] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const priceN = Number(price);
  const pointsN = Number(points || 0);
  let calc: ReturnType<typeof calcPayment> | null = null;
  let calcError: string | null = null;
  if (price !== '') {
    try {
      calc = calcPayment({
        price: priceN, points: pointsN, balance: a.balance, earnPercent, masterPercent, minRedeem: rules.minRedeem,
        cert: cert ? Number(certSum || 0) : 0, certBalance: cert?.balance ?? 0, materials: Number(materials || 0),
        prepaid: a.prepay?.paid ? a.prepay.prepaid : 0,
      });
    }
    catch (e) { calcError = (e as Error).message; }
  }

  async function send(kind: 'pay' | 'cancel') {
    setBusy(true); setError(null);
    const res = kind === 'pay'
      ? await fetch(`/api/${slug}/admin/payments`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointmentId: a.id, price: priceN, points: pointsN, method: calc?.cash === 0 ? (calc.cert ? 'CERT' : 'POINTS') : method,
            certCode: cert?.code ?? null, cert: cert ? Number(certSum || 0) : 0, materials: Number(materials || 0),
          }),
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
      position: 'fixed', inset: 0, background: 'rgba(23,35,28,.35)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="card stack" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, gap: 14, maxHeight: '92dvh', overflowY: 'auto' }}>
        <div>
          {a.clientId ? (
            <Link href={`/${slug}/admin/clients/${a.clientId}`} style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{a.client} ›</Link>
          ) : <strong style={{ fontSize: 18 }}>{a.client}</strong>}
          <div className="small muted">{a.service}{a.addons.length ? ` + ${a.addons.join(', ').toLowerCase()}` : ''}</div>
          {a.phone && <div className="small muted">{a.phone}</div>}
        </div>
        <ConnectClient slug={slug} id={a.id} token={a.visitToken ?? ''} bonus={rules.welcomeBonus ?? 0} />
        {!a.payment && <VisitStatus a={a} slug={slug} rules={rules} late={late} onDone={onClose} />}
        <EndTime a={a} slug={slug} />

        {a.payment ? (
          <>
            <div className="stack" style={{ gap: 6 }}>
              <Line label="Стоимость" value={formatSom(a.payment.finalPrice)} />
              {a.payment.pointsUsed > 0 && <Line label="Списано баллов" value={`−${a.payment.pointsUsed}`} />}
              {a.payment.cert > 0 && <Line label="Подарочным сертификатом" value={formatSom(a.payment.cert)} />}
              {(a.payment.cash > 0 || !a.payment.cert) && <Line label={`Оплачено ${METHOD_NAME[a.payment.method ?? 'CASH'] ?? ''}`} value={formatSom(a.payment.cash)} strong />}
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
            {a.prepay && <PrepayBox a={a} slug={slug} />}
            <label className="field">{isRange ? `Итоговая цена (${formatPrice(a.price, a.priceMax)})` : 'Цена, сом'}
              <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} placeholder="после консультации" />
            </label>
            <label className="field">Из них краска и материалы, сом
              <input inputMode="numeric" value={materials} onChange={(e) => setMaterials(e.target.value.replace(/\D/g, ''))} placeholder="0 — если материалов нет" />
              <span className="small muted" style={{ fontWeight: 400 }}>Материалы покупает салон: эта сумма целиком салону, доля мастера — с остального</span>
            </label>

            <div className="stack" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small" style={{ fontWeight: 700 }}>Баллы{a.payer !== a.client ? ` (счёт: ${a.payer})` : ''}</span>
                <span className="small muted">на счёте: <strong style={{ color: 'var(--ink)' }}>{a.balance}</strong></span>
              </div>
              {a.balance > 0 && rules.minRedeem && a.balance < rules.minRedeem ? (
                <span className="small muted">Списывать баллы можно с {rules.minRedeem} — пока копятся (ещё {rules.minRedeem - a.balance}).</span>
              ) : a.balance > 0 ? (
                <div className="row">
                  <input aria-label="Сколько баллов списать" inputMode="numeric" value={points}
                    onChange={(e) => setPoints(e.target.value.replace(/\D/g, ''))}
                    style={{ minHeight: 48, borderRadius: 12, border: '1px solid #dde5de', padding: '0 14px', fontSize: 16, width: 110 }} />
                  <button type="button" className="btn" disabled={!maxPoints} onClick={() => setPoints(String(maxPoints))}>Все {maxPoints || ''}</button>
                  <button type="button" className="btn" onClick={() => setPoints('0')}>Без баллов</button>
                </div>
              ) : <span className="small muted">Баллов пока нет — начислим с этой оплаты.</span>}
            </div>

            {rules.certificates && (
              <CertField slug={slug} cert={cert} sum={certSum} left={Math.max(0, (priceN || 0) - pointsN)}
                onCert={(c, sum) => { setCert(c); setCertSum(sum); }} onSum={setCertSum} />
            )}

            {calc && calc.cash > 0 && (
              <div className="tabs" role="group" aria-label="Как оплачен остаток">
                {METHODS.map((m) => <button key={m.id} type="button" aria-pressed={method === m.id} onClick={() => setMethod(m.id)}>{m.name}</button>)}
              </div>
            )}

            {calc && (
              <div className="stack" style={{ gap: 6, background: 'var(--ground)', borderRadius: 14, padding: 12 }}>
                {calc.prepaid > 0 && <Line label="Предоплатой (перевод)" value={`−${formatSom(calc.prepaid)}`} />}
                {calc.pointsUsed > 0 && <Line label="Баллами" value={`−${calc.pointsUsed}`} />}
                {calc.cert > 0 && <Line label="Сертификатом" value={`−${formatSom(calc.cert)}`} />}
                <Line label="К оплате деньгами" value={formatSom(calc.cash)} strong />
                <Line label={`Начислим баллов (${earnPercent}% от ${calc.cash + calc.cert})`} value={`+${calc.pointsEarned}`} />
                <Line label="Останется на счёте" value={String(calc.balanceAfter)} />
                {calc.materials > 0 && <Line label="Материалы — салону" value={formatSom(calc.materials)} />}
                <Line label={masterPercent ? `Мастеру (${masterPercent}%${calc.materials > 0 ? ' без материалов' : ''})` : 'Мастеру — директор, вся сумма салону'} value={formatSom(calc.masterShare)} />
              </div>
            )}
            {(calcError || error) && <div className="error" role="alert">{calcError || error}</div>}
            {a.date && rules.today && <RescheduleButton slug={slug} id={a.id} title={`${a.client} · ${a.service}`} date={a.date} today={rules.today} onMoved={onClose} style={{ alignSelf: 'flex-start' }} />}
            <CancelVisit a={a} slug={slug} onDone={onClose} />
            <div className="row">
              <button type="button" className="btn" onClick={onClose}>Отмена</button>
              <button type="button" className="btn primary grow" disabled={busy || !calc} onClick={() => send('pay')}>
                {busy ? 'Сохраняем…' : calc ? (calc.cash === 0 && calc.cert ? 'Оплачено сертификатом' : `Оплачено ${formatSom(calc.cash)}`) : 'Оплачено'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type CertInfo = { code: string; balance: number; amount: number; toName: string | null; expires: string };

/** Подарочный сертификат в оплате: ввести код → проверить → сколько списать (остаток останется на сертификате) */
function CertField({ slug, cert, sum, left, onCert, onSum }: {
  slug: string; cert: CertInfo | null; sum: string; left: number; onCert: (c: CertInfo | null, sum: string) => void; onSum: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function check() {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/${slug}/admin/certificates?code=${encodeURIComponent(code)}`);
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(d.error ?? 'Не получилось'); return; }
    onCert(d, String(Math.min(d.balance, left)));
  }
  if (cert) {
    return (
      <div className="stack" style={{ gap: 6, background: '#f7f1e3', border: '1px solid var(--gold)', borderRadius: 14, padding: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
          <span className="small"><b>🎁 Сертификат {cert.code}</b>{cert.toName ? ` · ${cert.toName}` : ''}<br /><span className="muted">на счёте {formatSom(cert.balance)} · до {cert.expires}</span></span>
          <button type="button" className="small" onClick={() => onCert(null, '')} style={{ border: 0, background: 'none', color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer' }}>убрать</button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="small" style={{ fontWeight: 700 }}>Списать</span>
          <input aria-label="Сколько списать с сертификата" inputMode="numeric" value={sum} onChange={(e) => onSum(e.target.value.replace(/\D/g, ''))}
            style={{ minHeight: 44, borderRadius: 12, border: '1px solid #dde5de', padding: '0 12px', fontSize: 16, width: 110 }} />
          <span className="small muted">сом · останется {formatSom(Math.max(0, cert.balance - Number(sum || 0)))}</span>
        </div>
      </div>
    );
  }
  if (!open) {
    return <button type="button" className="small" onClick={() => setOpen(true)} style={{ alignSelf: 'flex-start', border: 0, background: 'none', padding: 0, color: 'var(--accent-dark)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>🎁 Оплата подарочным сертификатом</button>;
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row" style={{ gap: 8 }}>
        <input aria-label="Код сертификата" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Код, напр. K7QM-4XRA" autoCapitalize="characters"
          style={{ minHeight: 44, borderRadius: 12, border: '1px solid #dde5de', padding: '0 12px', fontSize: 16, flex: 1, minWidth: 0, letterSpacing: 1 }} />
        <button type="button" className="btn" disabled={busy || code.replace(/[^A-Za-z0-9]/g, '').length < 8} onClick={check}>{busy ? '…' : 'Проверить'}</button>
      </div>
      {err && <div className="error" role="alert">{err}</div>}
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
  return <EndTimeEditor key={a.end} start={a.start} end={a.end} url={`/api/${slug}/admin/appointments/${a.id}`} />;
}

/** Клиент передумал — отменить запись (время освободится, клиенту с 🔔 придёт уведомление) */
function CancelVisit({ a, slug, onDone }: { a: ApptItem; slug: string; onDone: () => void }) {
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function cancel() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/${slug}/admin/appointments/${a.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Не получилось'); return; }
    onDone(); router.refresh();
  }
  return (
    <div className="stack" style={{ gap: 6, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      {ask ? (
        <div className="row" style={{ gap: 8 }}>
          <span className="small grow">Отменить запись {a.client} на {hhmm(a.start)}?{a.push ? ' Клиенту придёт уведомление.' : ''}</span>
          <button type="button" className="btn" style={{ minHeight: 40 }} onClick={() => setAsk(false)}>Нет</button>
          <button type="button" className="btn" style={{ minHeight: 40, color: 'var(--danger)', borderColor: '#e5c9cf' }} disabled={busy} onClick={cancel}>{busy ? '…' : 'Да, отменить'}</button>
        </div>
      ) : (
        <button type="button" className="small" onClick={() => setAsk(true)}
          style={{ alignSelf: 'flex-start', border: 0, background: 'none', padding: 0, color: 'var(--danger)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
          Клиент не придёт — отменить запись
        </button>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}

/** Пришёл ли клиент: «Пришёл», позвонить / написать опаздывающему, «Не пришёл» */
function VisitStatus({ a, slug, rules, late, onDone }: { a: ApptItem; slug: string; rules: LateRules; late: LateState; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = rules.nowMinute != null && rules.nowMinute >= a.start;
  const phone = a.phone?.replace(/\D/g, '') ?? '';
  const text = `Здравствуйте, ${a.client}! Это салон «${rules.salonName}». Ждём вас к ${hhmm(a.start)} — вы в пути?`;

  async function act(action: 'ARRIVED' | 'NO_SHOW') {
    setBusy(true); setError(null);
    const res = await fetch(`/api/${slug}/admin/appointments/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? 'Не получилось'); return; }
    if (action === 'NO_SHOW') onDone();
    router.refresh();
  }

  const small = { minHeight: 40, padding: '0 12px', fontSize: 14 } as const;
  return (
    <div className="stack" style={{ gap: 8 }}>
      {!!a.noShows && <div className="error" style={{ fontSize: 13 }}>Этот клиент уже не приходил {a.noShows} {a.noShows === 1 ? 'раз' : a.noShows < 5 ? 'раза' : 'раз'} — стоит заранее подтвердить визит.</div>}
      {a.lateMinutes ? <div className="note">Клиент предупредил: опоздает на {a.lateMinutes} мин.</div> : null}
      {late === 'call' && <div className="note" style={{ background: '#fdf1e2' }}>Прошло больше {rules.callAfter} мин — позвоните клиенту.</div>}
      {late === 'noshow' && <div className="error" style={{ fontSize: 13 }}>Прошло больше {rules.noShowAfter} мин. Если клиент не отвечает — отметьте «Не пришёл», и время мастера освободится.</div>}
      {a.arrived ? (
        <div className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>✓ Клиент в салоне</div>
      ) : (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="btn primary" style={small} disabled={busy} onClick={() => act('ARRIVED')}>Пришёл</button>
          {phone && started && <a className="btn" style={small} href={`tel:+${phone}`}>Позвонить</a>}
          {phone && started && <a className="btn" style={small} target="_blank" rel="noreferrer" href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}>WhatsApp</a>}
          {started && (
            <button type="button" className="btn" style={{ ...small, color: 'var(--danger)', borderColor: late === 'noshow' ? 'var(--danger)' : '#e5c9cf' }} disabled={busy} onClick={() => act('NO_SHOW')}>Не пришёл</button>
          )}
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}

/** Предоплата по записи: ждём (до какого времени) или получена */
function PrepayBox({ a, slug }: { a: ApptItem; slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const p = a.prepay!;
  if (p.paid) return <div className="note" style={{ fontWeight: 700 }}>✓ Предоплата получена: {formatSom(p.prepaid)}</div>;
  async function paid() {
    setBusy(true); setErr(null);
    const r = await fetch(`/api/${slug}/admin/prepay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'paid', id: a.id }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(d.error ?? 'Не получилось'); return; }
    router.refresh();
  }
  return (
    <div className="stack" style={{ gap: 8, background: '#fff6e5', border: '1px solid #f0d9a8', borderRadius: 14, padding: 12 }}>
      <strong>💳 Ждём предоплату {formatSom(p.amount)}{p.due != null ? ` до ${hhmm(p.due)}` : ''}</strong>
      <span className="small muted">Клиент уже не приходил. Пришёл перевод — нажмите кнопку. Не отметите вовремя — запись отменится сама, время освободится.</span>
      <button type="button" className="btn primary" disabled={busy} onClick={paid}>{busy ? '…' : '✓ Предоплата получена'}</button>
      {err && <div className="error" role="alert">{err}</div>}
    </div>
  );
}
