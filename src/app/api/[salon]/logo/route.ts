import { eq } from 'drizzle-orm';
import { db, schema as s } from '@/db';

/** Логотип салона, загруженный в настройках (он же значок приложения) */
export async function GET(_req: Request, ctx: { params: Promise<{ salon: string }> }) {
  const { salon } = await ctx.params;
  const row = await db.query.salons.findFirst({ where: eq(s.salons.slug, salon), columns: { logoData: true } });
  const m = row?.logoData?.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!m) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(m[2], 'base64'), { headers: { 'content-type': m[1], 'cache-control': 'public, max-age=31536000, immutable' } });
}
