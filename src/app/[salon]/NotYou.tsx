'use client';

import Link from 'next/link';
import { useT } from '@/app/Lang';

/** Телефон ещё не знает клиента: записи и баллы появятся после первой записи с него */
export default function NotYou({ slug, whatsapp }: { slug: string; whatsapp: string | null }) {
  const t = useT();
  const wa = whatsapp?.replace(/\D/g, '');
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p style={{ margin: 0, lineHeight: 1.5 }}>
        {t('Здесь появятся ваши записи и баллы, как только вы запишетесь с этого телефона.')}
      </p>
      <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
        {t('Уже записывались? Откройте ссылку из уведомления о записи — и телефон вас запомнит. Записывал администратор? Напишите нам — пришлём ссылку.')}
      </p>
      <Link href={`/${slug}/book`} className="btn primary">{t('Записаться')}</Link>
      {wa && <a className="btn" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">{t('Написать в WhatsApp')}</a>}
    </div>
  );
}
