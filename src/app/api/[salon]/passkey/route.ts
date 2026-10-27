import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  authenticationOptions, registrationOptions, removePasskey, verifyAuthentication, verifyRegistration, type PasskeyRole,
} from '@/server/passkey';

const Body = z.object({
  action: z.enum(['reg-options', 'reg-verify', 'auth-options', 'auth-verify', 'remove']),
  role: z.enum(['ADMIN', 'OWNER', 'MASTER', 'CLIENT']),
  response: z.any().optional(),
  credentialIds: z.array(z.string().max(512)).max(10).optional(),
  credentialId: z.string().max(512).optional(),
  device: z.string().max(200).nullable().optional(),
});

/** Вход по отпечатку / Face ID: включить, войти, выключить */
export async function POST(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  const { salon } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Неверный запрос' }, { status: 400 });
  const b = parsed.data;
  const role = b.role as PasskeyRole;
  try {
    switch (b.action) {
      case 'reg-options': return NextResponse.json(await registrationOptions(salon, role));
      case 'reg-verify': return NextResponse.json(await verifyRegistration(salon, role, b.response, b.device ?? null));
      case 'auth-options': return NextResponse.json(await authenticationOptions(salon, role, b.credentialIds ?? []));
      case 'auth-verify': return NextResponse.json(await verifyAuthentication(salon, role, b.response));
      case 'remove': await removePasskey(salon, role, b.credentialId ?? ''); return NextResponse.json({ ok: true });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
