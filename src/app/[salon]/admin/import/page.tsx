import Link from 'next/link';
import ImportForm from './ImportForm';
import Hints from '@/app/Hints';

export const dynamic = 'force-dynamic';

export default async function ImportPage({ params }: { params: Promise<{ salon: string }> }) {
  const { salon } = await params;
  return (
    <main className="safe" style={{ padding: '24px 28px 48px', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <Link href={`/${salon}/admin/settings`} className="small muted">‹ Настройки</Link>
        <h1 style={{ fontSize: 26, marginTop: 6 }}>Перенос записей</h1>
        <p className="muted" style={{ margin: '6px 0 10px' }}>Записи из бумажного журнала — разом, до того как клиенты начнут записываться онлайн.</p>
        <Hints items={[
          ['📝', <>Одна запись — одна строка: <b>дата; время; мастер; услуга; клиент; телефон</b></>],
          ['✂️', 'Для услуг по длине волос можно добавить в конце: короткие / средние / длинные / очень длинные'],
          ['📋', 'Можно вставить прямо из Excel или Google-таблицы — столбцы в том же порядке'],
          ['🔍', 'Сначала «Проверить»: приложение покажет накладки и ошибки, в журнал ничего не попадёт'],
          ['🔕', 'Клиентам при переносе ничего не отправляется'],
        ]} />
      </header>
      <ImportForm slug={salon} />
    </main>
  );
}
