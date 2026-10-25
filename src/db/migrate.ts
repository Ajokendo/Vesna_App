// Применяет миграции из папки drizzle/ к базе из DATABASE_URL (используется при публикации).
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index';

migrate(db, { migrationsFolder: './drizzle' })
  .then(() => { console.log('Миграции применены.'); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
