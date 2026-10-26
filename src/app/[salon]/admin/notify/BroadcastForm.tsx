'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { plural } from '@/lib/pricing';

type AType = 'ALL' | 'DATE' | 'WOMEN' | 'MEN' | 'MASTER';

const TEMPLATES = [
  { label: 'Нет электричества', kind: 'SERVICE', audience: 'DATE', title: 'Сегодня салон не работает', body: 'Извините, в салоне нет электричества. Мы свяжемся с вами, чтобы перенести запись на удобное время.' },
  { label: 'Задерживаемся', kind: 'SERVICE', audience: 'DATE', title: 'Салон откроется позже', body: 'Сегодня салон откроется в 11:00. Если ваша запись раньше — мы свяжемся с вами.' },
  { label: '8 Марта', kind: 'PROMO', audience: 'WOMEN', title: 'С 8 Марта!', body: 'Дорогие наши клиентки, поздравляем вас с праздником весны! Будьте красивы и любимы. Ваша «{salon}».' },
  { label: 'Новый год', kind: 'PROMO', audience: 'ALL', title: 'С Новым годом!', body: 'Спасибо, что были с нами в этом году! Желаем счастья и красоты в новом. Ваша «{salon}».' },
] as const;

const field = { minHeight: 48, borderRadius: 12, border: '1px solid #dde5de', padding: '0 12px', fontSize: 15, background: '#fff' } as const;

export default function BroadcastForm({ slug, salonName, today, masters }: { slug: string; salonName: string; today: string; masters: { id: string; name: string }[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<'SERVICE' | 'PROMO'>('SERVICE');
  const [type, setType] = useState<AType>('DATE');
  const [date, setDate] = useState(today);
  const [staffId, setStaffId] = useState(masters[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams({ kind, type, ...(type === 'DATE' ? { date } : {}), ...(type === 'MASTER' ? { staffId } : {}) });
    let alive = true;
    fetch(`/api/${slug}/admin/broadcast?${q}`).then((r) => r.json()).then((d) => { if (alive) setCount(d.count ?? 0); }).catch(() => {});
    setConfirm(false);
    return () => { alive = false; };
  }, [slug, kind, type, date, staffId]);

  async function send() {
    setBusy(true); setError(null); setResult(null);
    const audience = type === 'DATE' ? { type, date } : type === 'MASTER' ? { type, staffId } : { type };
    const res = await fetch(`/api/${slug}/admin/broadcast`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, kind, audience }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false); setConfirm(false);
    if (!res.ok) { setError(d.error ?? 'Не получилось'); return; }
    setResult(`Отправлено: ${d.recipients} ${plural(d.recipients, 'клиент', 'клиента', 'клиентов')}, доставлено на ${d.delivered} ${plural(d.delivered, 'телефон', 'телефона', 'телефонов')}.`);
    setTitle(''); setBody('');
    router.refresh();
  }

  return (
    <section className="card stack" style={{ gap: 14 }}>
      <h2 style={{ fontSize: 18 }}>Новая рассылка</h2>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <span className="small muted">Шаблоны:</span>
        {TEMPLATES.map((t) => (
          <button key={t.label} type="button" className="btn" style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }} onClick={() => {
            setKind(t.kind); setType(t.audience); setTitle(t.title); setBody(t.body.replace('{salon}', salonName));
          }}>{t.label}</button>
        ))}
      </div>
      <div className="tabs" role="group" aria-label="Тип рассылки">
        <button type="button" aria-pressed={kind === 'SERVICE'} onClick={() => setKind('SERVICE')}>Важное о работе салона</button>
        <button type="button" aria-pressed={kind === 'PROMO'} onClick={() => setKind('PROMO')}>Поздравление или акция</button>
      </div>
      <div className="grid2">
        <label className="field">Кому
          <select value={type} onChange={(e) => setType(e.target.value as AType)} style={field}>
            <option value="DATE">Записанным на день</option>
            <option value="ALL">Всем клиентам</option>
            <option value="WOMEN">Женщинам</option>
            <option value="MEN">Мужчинам</option>
            <option value="MASTER">Клиентам мастера</option>
          </select>
        </label>
        {type === 'DATE' && <label className="field">День<input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={field} /></label>}
        {type === 'MASTER' && (
          <label className="field">Мастер
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={field}>
              {masters.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}
      </div>
      <label className="field">Заголовок<input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Сегодня салон не работает" /></label>
      <label className="field">Текст
        <textarea value={body} maxLength={300} onChange={(e) => setBody(e.target.value)} rows={3}
          style={{ borderRadius: 12, border: '1px solid #dde5de', padding: '10px 14px', fontSize: 16, fontFamily: 'inherit', resize: 'vertical' }} />
      </label>
      <p className="small muted" style={{ margin: 0, lineHeight: 1.45 }}>
        Получат: <strong style={{ color: 'var(--ink)' }}>{count ?? '…'}</strong> {plural(count ?? 0, 'клиент', 'клиента', 'клиентов')} с включёнными уведомлениями.
        {kind === 'PROMO' ? ' Отписавшиеся от поздравлений и акций не получат.' : ' Важное получат все выбранные.'}
        {' '}Мужчин и женщин приложение различает по залу, куда клиент записывался.
      </p>
      {error && <div className="error" role="alert">{error}</div>}
      {result && <div className="note">{result}</div>}
      {confirm ? (
        <div className="row">
          <button type="button" className="btn" onClick={() => setConfirm(false)}>Назад</button>
          <button type="button" className="btn primary grow" disabled={busy} onClick={send}>{busy ? 'Отправляем…' : `Да, отправить: ${count ?? ''} ${plural(count ?? 0, 'клиент', 'клиента', 'клиентов')}`}</button>
        </div>
      ) : (
        <button type="button" className="btn primary block" disabled={!title.trim() || !body.trim() || !count} onClick={() => setConfirm(true)}>Отправить</button>
      )}
    </section>
  );
}
