import { NextResponse, type NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { isOwner } from '@/server/owner-auth';
import { getSalon } from '@/server/salon';
import { ownerReport } from '@/server/reports';
import { PERIODS, type PeriodKind } from '@/lib/period';
import { utcToZoned } from '@/lib/time';

export const dynamic = 'force-dynamic';

/** Зарплатная ведомость за период в Excel: лист «Итого» и по листу на каждого мастера */
export async function GET(req: NextRequest, ctx: { params: Promise<{ salon: string }> }) {
  const { salon: slug } = await ctx.params;
  if (!(await isOwner(slug))) return NextResponse.json({ error: 'Нужен вход директора' }, { status: 401 });
  const salon = await getSalon(slug);
  if (!salon) return NextResponse.json({ error: 'Салон не найден' }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const kind = (PERIODS.find((x) => x.id === sp.get('p'))?.id ?? 'month') as PeriodKind;
  const at = /^\d{4}-\d{2}-\d{2}$/.test(sp.get('at') ?? '') ? sp.get('at')! : utcToZoned(new Date(), salon.timezone).date;
  const r = await ownerReport(slug, kind, at);

  const wb = new ExcelJS.Workbook();
  wb.creator = salon.name;
  const money = '#,##0" сом"';
  const head = (ws: ExcelJS.Worksheet, title: string) => {
    ws.addRow([title]).font = { bold: true, size: 14 };
    ws.addRow([`Салон «${salon.name}», период: ${r.period.label} (${r.period.from} — ${r.period.to})`]).font = { color: { argb: 'FF666666' } };
    ws.addRow([]);
  };

  const sum = wb.addWorksheet('Итого');
  head(sum, 'Зарплата мастерам');
  const h = sum.addRow(['Мастер', 'Визитов', 'Стоимость услуг', 'Оплачено баллами', 'Получено деньгами', 'Доля, %', 'К выплате']);
  h.font = { bold: true };
  const ms = r.masters.filter((m) => m.visits > 0 || m.active);
  for (const m of ms) {
    sum.addRow([m.isOwner ? `${m.name} (директор)` : m.name, m.visits, m.price, m.points, m.cash, m.isOwner ? 0 : m.percent, m.isOwner ? 0 : m.master]);
  }
  const tot = sum.addRow(['Итого', ms.reduce((n, m) => n + m.visits, 0), ms.reduce((n, m) => n + m.price, 0), ms.reduce((n, m) => n + m.points, 0),
    ms.reduce((n, m) => n + m.cash, 0), '', ms.reduce((n, m) => n + (m.isOwner ? 0 : m.master), 0)]);
  tot.font = { bold: true };
  sum.columns = [{ width: 26 }, { width: 10 }, { width: 18 }, { width: 18 }, { width: 20 }, { width: 10 }, { width: 16 }];
  for (const c of [3, 4, 5, 7]) sum.getColumn(c).numFmt = money;

  for (const m of ms.filter((x) => x.lines.length)) {
    const ws = wb.addWorksheet(m.name.slice(0, 28).replace(/[\\/?*[\]:]/g, ''));
    head(ws, `${m.name}: визиты`);
    ws.addRow(['Дата', 'Услуга', 'Цена', 'Баллами', 'Деньгами', 'Мастеру']).font = { bold: true };
    for (const l of m.lines) ws.addRow([l.date, l.service, l.price, l.points, l.cash, m.isOwner ? 0 : l.share]);
    ws.addRow(['Итого', '', m.price, m.points, m.cash, m.isOwner ? 0 : m.master]).font = { bold: true };
    ws.columns = [{ width: 12 }, { width: 40 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 14 }];
    for (const c of [3, 4, 5, 6]) ws.getColumn(c).numFmt = money;
  }

  const buf = await wb.xlsx.writeBuffer();
  const name = `zarplata_${slug}_${r.period.from}.xlsx`;
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'private, no-store',
    },
  });
}
