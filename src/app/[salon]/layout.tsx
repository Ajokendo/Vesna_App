import type { Metadata, Viewport } from 'next';
import { eq } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { themeVars } from '@/lib/color';

// Общее для всех страниц салона: название во вкладке, цвет темы, манифест (значок, быстрые пункты),
// и демо-доступ — после даты окончания приложение салона закрывается.

async function load(slug: string) {
  return db.query.salons.findFirst({ where: eq(s.salons.slug, slug) });
}

export async function generateMetadata({ params }: { params: Promise<{ salon: string }> }): Promise<Metadata> {
  const salon = await load((await params).salon);
  if (!salon) return {};
  const icon = salon.logoData ? `/api/${salon.slug}/logo?v=${salon.logoUrl?.split('v=')[1] ?? '1'}` : (salon.logoUrl ?? '/icon-192.png?v=2');
  return {
    title: `${salon.tagline ?? 'Салон'} «${salon.name}» — онлайн-запись`,
    description: `Запись к мастерам салона «${salon.name}»${salon.city ? `, ${salon.city}` : ''}`,
    icons: { icon, apple: icon },
  };
}

export async function generateViewport({ params }: { params: Promise<{ salon: string }> }): Promise<Viewport> {
  const salon = await load((await params).salon);
  return { themeColor: salon?.accentColor ?? '#4E6B45', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
}

export default async function SalonLayout({ children, params }: { children: React.ReactNode; params: Promise<{ salon: string }> }) {
  const { salon: slug } = await params;
  const salon = await load(slug);
  const vars = themeVars(salon?.accentColor ?? '#4E6B45');
  const css = `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`;
  if (salon?.demoUntil && salon.demoUntil.getTime() < Date.now()) {
    return (
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <style>{css}</style>
        <div>
          <h1 style={{ fontWeight: 400, fontSize: 28, color: 'var(--accent)' }}>Демо-период завершён</h1>
          <div style={{ width: 48, height: 1, background: 'var(--gold)', margin: '18px auto' }} />
          <p className="muted" style={{ lineHeight: 1.5 }}>Спасибо, что попробовали приложение салона «{salon.name}».<br />Чтобы продолжить, свяжитесь с разработчиком.</p>
        </div>
      </main>
    );
  }
  return (
    <>
      <style>{css}</style>
      {/* use-credentials: манифест получает cookie, чтобы установленное приложение узнало клиента */}
      <link rel="manifest" href={`/api/manifest?s=${slug}`} crossOrigin="use-credentials" />
      {children}
    </>
  );
}
