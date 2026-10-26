'use client';

import { useState } from 'react';
import { Msg, inputSt, useSave } from './ui';

type Salon = {
  name: string; tagline: string | null; city: string | null; address: string | null; phone: string | null; whatsapp: string | null; instagram: string | null;
  bookingHorizonDays: number; minLeadMinutes: number; pointsPercent: number; defaultCommission: number; lateCallMinutes: number; noShowMinutes: number;
};

const TEXT: { key: keyof Salon; label: string }[] = [
  { key: 'name', label: 'Название' }, { key: 'tagline', label: 'Подпись (например, «Салон красоты»)' }, { key: 'city', label: 'Город' },
  { key: 'address', label: 'Адрес' }, { key: 'phone', label: 'Телефон' }, { key: 'whatsapp', label: 'WhatsApp' }, { key: 'instagram', label: 'Instagram' },
];
const NUM: { key: keyof Salon; label: string; hint: string }[] = [
  { key: 'bookingHorizonDays', label: 'Запись вперёд, дней', hint: 'на сколько дней вперёд клиенты видят свободное время' },
  { key: 'minLeadMinutes', label: 'Не позже чем за, минут', hint: 'минимум до начала визита для онлайн-записи' },
  { key: 'pointsPercent', label: 'Баллы, % от оплаты деньгами', hint: '0 — баллы не начисляются' },
  { key: 'defaultCommission', label: 'Доля мастера, %', hint: 'для мастеров без своей доли' },
  { key: 'lateCallMinutes', label: 'Опоздание: позвонить через, мин', hint: 'запись в журнале становится оранжевой' },
  { key: 'noShowMinutes', label: '«Не пришёл» через, мин', hint: 'запись красная, можно отдать время другому' },
];

export default function SalonForm({ slug, salon }: { slug: string; salon: Salon }) {
  const [v, setV] = useState<Record<string, string>>(Object.fromEntries([...TEXT, ...NUM].map(({ key }) => [key, String(salon[key] ?? '')])));
  const { busy, msg, save } = useSave(slug);
  function submit() {
    const data: Record<string, unknown> = {};
    for (const { key } of TEXT) data[key] = key === 'name' ? v[key].trim() : (v[key].trim() || null);
    for (const { key } of NUM) data[key] = Number(v[key]);
    save('salon', data);
  }
  return (
    <section className="card stack" style={{ gap: 16 }}>
      <h2 style={{ fontSize: 18 }}>Салон</h2>
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
