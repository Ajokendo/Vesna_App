import Link from 'next/link';

/** Телефон ещё не знает клиента: записи и баллы появятся после первой записи с него */
export default function NotYou({ slug, whatsapp }: { slug: string; whatsapp: string | null }) {
  const wa = whatsapp?.replace(/\D/g, '');
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p style={{ margin: 0, lineHeight: 1.5 }}>
        Здесь появятся ваши записи и баллы, как только вы запишетесь с этого телефона.
      </p>
      <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
        Уже записывались? Откройте ссылку из уведомления о записи — и телефон вас запомнит. Записывал администратор? Напишите нам — пришлём ссылку.
      </p>
      <Link href={`/${slug}/book`} className="btn primary">Записаться</Link>
      {wa && <a className="btn" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">Написать в WhatsApp</a>}
    </div>
  );
}
