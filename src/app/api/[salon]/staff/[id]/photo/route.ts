import { eq } from 'drizzle-orm';
import { db, schema as s } from '@/db';

/** Фото мастера, загруженное в настройках */
export async function GET(_req: Request, ctx: { params: Promise<{ salon: string; id: string }> }) {
  const { id } = await ctx.params;
  const m = await db.query.staff.findFirst({ where: eq(s.staff.id, id), columns: { photoData: true } });
  const match = m?.photoData?.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!match) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(match[2], 'base64'), {
    headers: { 'content-type': match[1], 'cache-control': 'public, max-age=31536000, immutable' },
  });
}
