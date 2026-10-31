'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ImportCheck } from '@/server/import';

type Result = { rows: ImportCheck[]; ok: number; failed: number; created: number };

const EXAMPLE = `12.11; 10:00; Жаннат; Стрижка; Айгуль; 0555 12 34 56
12.11; 14:30; Рэйна; Окрашивание; Мээрим; +996 700 11 22 33; длинные`;

export default function ImportForm({ slug }: { slug: string }) {
  const [text, setText] = useState('');
  const [res, setRes] = useState<Result | null>(null);
  const [checked, setChecked] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<Result | null>(null);

  async function run(commit: boolean) {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/${slug}/admin/import`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, commit }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'Ошибка');
      if (commit) {
        setDone(j);
        // оставляем в поле только строки, которые не загрузились — их можно поправить и загрузить снова
        const bad = new Set((j as Result).rows.filter((x) => !x.ok).map((x) => x.line));
        setText(text.split(/\r?\n/).filter((_, i) => bad.has(i + 1)).join('\n'));
        setRes(null); setChecked('');
      } else { setRes(j); setChecked(text); setDone(null); }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const fresh = res && checked === text;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {done && (
        <div className="card" style={{ background: '#eef7ea', borderColor: '#bfe0b1' }}>
          <b>✓ Перенесено записей: {done.created}</b>
          {done.failed > 0 && <div className="small" style={{ marginTop: 4 }}>Не загрузились: {done.failed} — они остались в поле ниже, поправьте и проверьте снова.</div>}
          <div style={{ marginTop: 8 }}><Link href={`/${slug}/admin`} className="btn" style={{ minHeight: 40, fontSize: 14 }}>Открыть журнал</Link></div>
        </div>
      )}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} spellCheck={false} placeholder={EXAMPLE}
        style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 14, padding: 12, borderRadius: 12, border: '1px solid var(--line)', lineHeight: 1.5 }} />
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn" disabled={busy || !text.trim()} onClick={() => run(false)}>{busy && !fresh ? 'Проверяем…' : '🔍 Проверить'}</button>
        {fresh && res.ok > 0 && (
          <button type="button" className="btn primary" disabled={busy} onClick={() => run(true)}>
            {busy ? 'Загружаем…' : `Загрузить ${res.ok} ${plural(res.ok)}${res.failed ? ` (с ошибками ${res.failed} — пропустим)` : ''}`}
          </button>
        )}
        {!text && <button type="button" className="btn" style={{ fontSize: 13 }} onClick={() => setText(EXAMPLE)}>Вставить пример</button>}
      </div>
      {err && <div className="error">{err}</div>}
      {fresh && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', fontWeight: 700 }}>
            ✓ Готово к переносу: {res.ok}{res.failed > 0 && <span style={{ color: '#b3261e' }}> · ✕ С ошибками: {res.failed}</span>}
          </div>
          <div style={{ display: 'grid' }}>
            {res.rows.map((r) => (
              <div key={r.line} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 8, padding: '9px 14px', borderBottom: '1px solid var(--line)', background: r.ok ? (r.warn ? '#fff8e6' : '#fff') : '#fdeceb' }}>
                <span className="small muted">{r.line}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, overflowWrap: 'anywhere' }}>
                    {r.ok ? '✓ ' : '✕ '}<b>{r.date} {r.time}</b>{r.staff && <> · {r.staff}</>}{r.service && <> · {r.service}</>}{r.client && <> · {r.client}</>}{r.phone && <span className="muted"> {r.phone}</span>}
                  </div>
                  {r.error && <div className="small" style={{ color: '#b3261e', marginTop: 2 }}>{r.error}</div>}
                  {r.warn && <div className="small" style={{ color: '#8a5a00', marginTop: 2 }}>⚠ {r.warn}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function plural(n: number) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return 'запись';
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return 'записи';
  return 'записей';
}
