'use client';

import { useState } from 'react';
import EndTimeEditor from '@/app/EndTimeEditor';
import Tip from '@/app/Tip';

/** Кнопка в кабинете мастера: «Закончу раньше / задержусь» */
export default function EndToggle({ slug, id, start, end }: { slug: string; id: string; start: number; end: number }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <span className="row" style={{ gap: 6, alignSelf: 'flex-start' }}>
      <button type="button" onClick={() => setOpen(true)} className="small"
        style={{ border: '1px solid var(--line)', background: '#fff', borderRadius: 8, padding: '4px 10px', fontWeight: 700, color: 'var(--accent-dark)', cursor: 'pointer' }}>
        ⏱ Закончу раньше / задержусь
      </button>
      <Tip slug={slug} role="master" help="master" text="Поменяйте время окончания: администратор увидит это в журнале, а онлайн-запись сразу освободит или займёт время после вас." />
      </span>
    );
  }
  return <EndTimeEditor key={end} compact start={start} end={end} url={`/api/${slug}/master/appointments/${id}`} />;
}
