// Опоздание клиента: когда напомнить администратору позвонить и когда можно отметить «не пришёл».

export type LateState = 'none' | 'reported' | 'call' | 'noshow';

export function lateState(p: {
  start: number; nowMinute: number | null; paid: boolean; arrived: boolean; lateMinutes: number | null;
  callAfter: number; noShowAfter: number;
}): LateState {
  if (p.paid || p.arrived || p.nowMinute == null) return 'none';
  const since = p.nowMinute - p.start;
  const extra = p.lateMinutes ?? 0; // клиент предупредил — ждём дольше
  if (since >= p.noShowAfter + extra) return 'noshow';
  if (since >= p.callAfter + extra) return 'call';
  if (p.lateMinutes && since >= -30) return 'reported';
  return 'none';
}
