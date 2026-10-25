import { NextResponse, type NextRequest } from 'next/server';

// Демо-доступ: после этого момента все страницы и API закрываются.
// Переопределяется переменной DEMO_UNTIL (ISO-дата); DEMO_UNTIL=off — без ограничения.
const DEFAULT_UNTIL = '2026-10-27T22:00:00+06:00';

const page = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Демо-период завершён</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F6F3EC;color:#2E3A2B;
font-family:Georgia,'Times New Roman',serif;text-align:center;padding:24px;box-sizing:border-box}
h1{font-weight:400;font-size:28px;margin:0 0 12px;color:#4E6B45}p{font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;margin:0;color:#5b6657}
.line{width:48px;height:1px;background:#B8995A;margin:18px auto}</style></head>
<body><div><h1>Демо-период завершён</h1><div class="line"></div>
<p>Спасибо, что попробовали приложение.<br>Чтобы продолжить, свяжитесь с разработчиком.</p></div></body></html>`;

export function middleware(req: NextRequest) {
  const until = process.env.DEMO_UNTIL ?? DEFAULT_UNTIL;
  if (until === 'off') return NextResponse.next();
  const end = Date.parse(until);
  if (Number.isNaN(end) || Date.now() < end) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Демо-период завершён' }, { status: 403 });
  }
  return new NextResponse(page, { status: 403, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico).*)'],
};
