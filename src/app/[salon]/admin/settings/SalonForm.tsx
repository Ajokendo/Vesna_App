'use client';

import { useState } from 'react';
import { Msg, inputSt, useSave } from './ui';

type Salon = {
  accentColor: string; logoUrl: string | null; hoursText: string | null; mapUrl: string | null; menHallNote: string | null; womenHallNote: string | null;
  name: string; tagline: string | null; city: string | null; address: string | null; phone: string | null; whatsapp: string | null; instagram: string | null;
  bookingHorizonDays: number; minLeadMinutes: number; pointsPercent: number; welcomeBonus: number; minRedeem: number; defaultCommission: number; lateCallMinutes: number; noShowMinutes: number;
};

const TEXT: { key: keyof Salon; label: string }[] = [
  { key: 'name', label: 'Название' }, { key: 'tagline', label: 'Подпись (например, «Салон красоты»)' }, { key: 'city', label: 'Город' },
  { key: 'address', label: 'Адрес' }, { key: 'phone', label: 'Телефон' }, { key: 'whatsapp', label: 'WhatsApp' }, { key: 'instagram', label: 'Instagram' },
  { key: 'hoursText', label: 'Часы работы (на главной)' },
  { key: 'mapUrl', label: 'Ссылка на салон в 2ГИС («Поделиться» в 2ГИС)' },
  { key: 'menHallNote', label: 'Подпись «Мужской зал»' }, { key: 'womenHallNote', label: 'Подпись «Женский зал»' },
];

const COLORS = ['#4E6B45', '#2F5D62', '#6B4E71', '#8A3B4F', '#B5651D', '#2E4A7D', '#3D3D3D', '#A2785C'];

/** Логотип → квадрат 512×512 PNG на белом фоне (подходит и как значок приложения) */
async function squareLogo(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const S = 512; const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, S, S);
  const k = Math.min(S / img.width, S / img.height) * 0.92;
  const w = img.width * k; const h = img.height * k;
  ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
  return c.toDataURL('image/png');
}
const NUM: { key: keyof Salon; label: string; hint: string }[] = [
  { key: 'bookingHorizonDays', label: 'Запись вперёд, дней', hint: 'на сколько дней вперёд клиенты видят свободное время' },
  { key: 'minLeadMinutes', label: 'Не позже чем за, минут', hint: 'минимум до начала визита для онлайн-записи' },
  { key: 'pointsPercent', label: 'Баллы, % от оплаты деньгами', hint: '0 — баллы не начисляются' },
  { key: 'minRedeem', label: 'Тратить баллы можно от, баллов', hint: 'пока на счёте меньше — копятся; 0 — сразу' },
  { key: 'welcomeBonus', label: 'Подарок за установку приложения, баллов', hint: 'один раз каждому клиенту; 0 — без подарка' },
  { key: 'defaultCommission', label: 'Доля мастера, %', hint: 'для мастеров без своей доли' },
  { key: 'lateCallMinutes', label: 'Опоздание: позвонить через, мин', hint: 'запись в журнале становится оранжевой' },
  { key: 'noShowMinutes', label: '«Не пришёл» через, мин', hint: 'запись красная, можно отдать время другому' },
];

export default function SalonForm({ slug, salon }: { slug: string; salon: Salon }) {
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries([...TEXT, ...NUM].map(({ key }) => [key, String(salon[key] ?? '')])));
  const { busy, msg, save, setMsg } = useSave(slug);
  const [color, setColor] = useState(salon.accentColor.toUpperCase());
  const [logo, setLogo] = useState<string | null | undefined>(undefined);
  const shownLogo = logo === undefined ? salon.logoUrl : logo;
  function submit() {
    const data: Record<string, unknown> = { accentColor: color, logo };
    for (const { key } of TEXT) data[key] = key === 'name' ? v[key].trim() : (v[key].trim() || null);
    for (const { key } of NUM) data[key] = Number(v[key]);
    save('salon', data);
  }
  return (
    <section className="card stack" style={{ gap: 16 }}>
      <h2 style={{ fontSize: 18 }}>Салон</h2>
      <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ width: 72, height: 72, borderRadius: '50%', border: '1px solid var(--line)', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {shownLogo ? <img src={shownLogo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="small muted">лого</span>}
        </span>
        <label className="btn" style={{ minHeight: 40, cursor: 'pointer' }}>
          {shownLogo ? 'Заменить логотип' : 'Загрузить логотип'}
          <input type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try { setLogo(await squareLogo(f)); } catch { setMsg({ ok: false, text: 'Не удалось открыть картинку — попробуйте PNG или JPEG' }); }
          }} />
        </label>
        <span className="small muted" style={{ flex: '1 1 160px' }}>Логотип — на главной и значок приложения на телефоне клиента.</span>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="small" style={{ fontWeight: 800 }}>Основной цвет приложения</span>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {COLORS.map((c) => (
            <button key={c} type="button" aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)}
              style={{ width: 36, height: 36, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '3px solid var(--ink)' : '2px solid #fff', boxShadow: '0 0 0 1px var(--line)' }} />
          ))}
          <input type="color" aria-label="Свой цвет" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} style={{ width: 44, height: 36, border: 0, background: 'none', padding: 0 }} />
        </div>
      </div>
      <div className="grid2">
        {TEXT.map(({ key, label }) => (
          <label key={key} className="field">{label}<input value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} style={inputSt} /></label>
        ))}
      </div>
      <h2 style={{ fontSize: 18 }}>Правила записи, баллы и опоздания</h2>
      <div className="grid2">
        {NUM.map(({ key, label, hint }) => (
          <label key={key} className="field">{label}
            <input inputMode="numeric" value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value.replace(/\D/g, '') })} style={inputSt} />
            <span className="small muted" style={{ fontWeight: 500 }}>{hint}</span>
          </label>
        ))}
      </div>
      <div className="row"><button type="button" className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Сохраняем…' : 'Сохранить'}</button><Msg msg={msg} /></div>
    </section>
  );
}
