import type { Metadata, Viewport } from 'next';
import { eq } from 'drizzle-orm';
import { db, schema as s } from '@/db';
import { themeVars } from '@/lib/color';
import ClientLock from '@/app/ClientLock';

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
      {salon && <Lock slug={slug} logo={salon.logoData ? `/api/${salon.slug}/logo?v=${salon.logoUrl?.split('v=')[1] ?? '1'}` : (salon.logoUrl ?? '/icon-512.png?v=2')} name={salon.name} />}
      {salon && <Splash logo={salon.logoData ? `/api/${salon.slug}/logo?v=${salon.logoUrl?.split('v=')[1] ?? '1'}` : (salon.logoUrl ?? '/icon-512.png?v=2')} name={salon.name} />}
      {children}
    </>
  );
}

/**
 * Заставка при запуске приложения со значка: крупный логотип на полсекунды, затем плавно исчезает.
 * Показывается только в установленном приложении и один раз за запуск (не при переходах по страницам).
 * Скрипт срабатывает до первой отрисовки страницы, поэтому главная не «мигает» перед заставкой.
 */
function Splash({ logo, name }: { logo: string; name: string }) {
  const script = `(function(){try{var d=document.documentElement;var st=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
if(!st||sessionStorage.getItem('splash'))return;sessionStorage.setItem('splash','1');d.classList.add('splash-on');
setTimeout(function(){d.classList.add('splash-out');setTimeout(function(){d.classList.remove('splash-on','splash-out')},380)},750);}catch(e){}})();`;
  return (
    <>
      <div id="splash" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" />
        <span>{name}</span>
      </div>
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  );
}

/** Замок «Отпечаток / Face ID» для клиента: закрывает страницы клиента до подтверждения (у сотрудников свой вход) */
function Lock({ slug, logo, name }: { slug: string; logo: string; name: string }) {
  const script = `(function(){try{var p=location.pathname;if(/^\\/[^/]+\\/(admin|owner|master)(\\/|$)/.test(p))return;
if(!localStorage.getItem('pk:${slug}:CLIENT')||sessionStorage.getItem('unlocked:${slug}'))return;
document.documentElement.classList.add('locked');}catch(e){}})();`;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <ClientLock slug={slug} logo={logo} name={name} />
    </>
  );
}
