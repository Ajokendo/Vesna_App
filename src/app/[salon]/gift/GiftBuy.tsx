'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatSom } from '@/lib/pricing';
import { useT } from '@/app/Lang';

const AMOUNTS = [500, 1000, 3000, 5000];

/** Чек: фото уменьшаем до 1600 px (JPEG), PDF — как есть (до 2,5 МБ) */
async function readReceipt(file: File): Promise<string> {
  if (file.type === 'application/pdf') {
    if (file.size > 2_500_000) throw new Error('big');
    return new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = fail; r.readAsDataURL(file); });
  }
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

/** Купить сертификат в приложении: сумма, кому, перевод по реквизитам салона, чек — салон подтверждает */
export default function GiftBuy({ slug, details, me }: { slug: string; details: string; me: { name: string } | null }) {
  const t = useT();
  const router = useRouter();
  const [f, setF] = useState({ amount: '1000', toName: '', fromName: me?.name ?? '', recipientPhone: '', name: '', phone: '+996 ' });
  const [receipt, setReceipt] = useState<{ data: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const amount = Number(f.amount) || 0;

  async function pick(file: File | undefined) {
    if (!file) return;
    setErr(null);
    try { setReceipt({ data: await readReceipt(file), name: file.name }); }
    catch { setErr(t('Не получилось прочитать файл — прикрепите фото или скриншот чека')); }
  }
  async function send() {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/${slug}/certificates`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount, toName: f.toName.trim() || null, fromName: f.fromName.trim() || null, recipientPhone: f.recipientPhone.trim() || null,
        buyer: me ? null : { name: f.name.trim(), phone: f.phone.trim() }, receipt: receipt?.data,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(d.error ? t(d.error) : t('Не получилось')); return; }
    setDone(true); router.refresh();
  }

  if (done) {
    return (
      <div className="note stack" style={{ gap: 6 }}>
        <strong>✓ {t('Заявка отправлена')}</strong>
        <span>{t('Салон проверит перевод и подтвердит — сертификат появится ниже, в «Мои сертификаты», и придёт уведомление.')}</span>
      </div>
    );
  }
  const ready = amount >= 100 && !!receipt && (me || (f.name.trim().length >= 2 && f.phone.replace(/\D/g, '').length >= 9));
  return (
    <section className="card stack" style={{ gap: 12 }}>
      <strong style={{ fontSize: 17 }}>🛍 {t('Купить сертификат')}</strong>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {AMOUNTS.map((a) => (
          <button key={a} type="button" className="btn" aria-pressed={f.amount === String(a)} onClick={() => setF({ ...f, amount: String(a) })}
            style={{ minHeight: 40, fontSize: 14, background: f.amount === String(a) ? 'var(--accent)' : undefined, color: f.amount === String(a) ? '#fff' : undefined }}>{formatSom(a)}</button>
        ))}
      </div>
      <label className="field">{t('Сумма, сом')}<input inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} /></label>
      <div className="grid2">
        <label className="field">{t('Кому (имя)')}<input value={f.toName} onChange={(e) => setF({ ...f, toName: e.target.value })} placeholder={t('необязательно')} /></label>
        <label className="field">{t('От кого')}<input value={f.fromName} onChange={(e) => setF({ ...f, fromName: e.target.value })} /></label>
      </div>
      <label className="field">{t('Телефон получателя')}
        <input type="tel" inputMode="tel" value={f.recipientPhone} onChange={(e) => setF({ ...f, recipientPhone: e.target.value })} placeholder={t('необязательно — сертификат появится в его приложении')} />
      </label>
      {!me && (
        <div className="grid2">
          <label className="field">{t('Ваше имя')}<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>
          <label className="field">{t('Ваш телефон')}<input type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" /></label>
        </div>
      )}
      <div className="stack" style={{ gap: 6, background: '#fff6e5', border: '1px solid #f0d9a8', borderRadius: 14, padding: 12 }}>
        <span>1. {t('Переведите {sum} на', { sum: formatSom(amount) })}: <b style={{ whiteSpace: 'pre-wrap' }}>{details}</b></span>
        <span>2. {t('Прикрепите чек — фото или скриншот из банка')}</span>
        <label className="btn" style={{ cursor: 'pointer', alignSelf: 'flex-start' }}>
          📎 {receipt ? t('Чек прикреплён — заменить') : t('Прикрепить чек')}
          <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {receipt && <span className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>✓ {receipt.name}</span>}
      </div>
      {err && <div className="error" role="alert">{err}</div>}
      <button type="button" className="btn primary" disabled={busy || !ready} onClick={send}>{busy ? t('Отправляем…') : t('Отправить заявку')}</button>
      <span className="small muted">{t('Сертификат начнёт действовать, когда салон подтвердит оплату.')}</span>
    </section>
  );
}
