import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSalon } from '@/server/salon';
import { isOwner } from '@/server/owner-auth';
import { addExpense, deleteExpense, EXPENSE_CATEGORIES, ExpenseInput, ownerReport } from '@/server/reports';
import { formatSom } from '@/lib/pricing';
import { dayMonthShort, utcToZoned } from '@/lib/time';
import { PeriodBar, Stat, grid, readPeriod } from '../ui';

export const dynamic = 'force-dynamic';

/** Расходы и прибыль: хозяйка вносит расходы, приложение считает прибыль = выручка − мастерам − расходы */
export default async function Costs({ params, searchParams }: { params: Promise<{ salon: string }>; searchParams: Promise<{ p?: string; at?: string; e?: string }> }) {
  const { salon: slug } = await params;
  const sp = await searchParams;
  const salon = await getSalon(slug);
  if (!salon) notFound();
  const { kind, at } = readPeriod(sp, salon.timezone);
  const r = await ownerReport(slug, kind, at);
  const today = utcToZoned(new Date(), salon.timezone).date;
  const defaultDate = today >= r.period.from && today < r.period.to ? today : r.period.from;

  async function add(fd: FormData) {
    'use server';
    if (!(await isOwner(slug))) return;
    const parsed = ExpenseInput.safeParse({
      date: String(fd.get('date') ?? ''), category: String(fd.get('category') ?? ''),
      amount: Number(String(fd.get('amount') ?? '').replace(/\D/g, '')), note: String(fd.get('note') ?? '') || null,
    });
    if (parsed.success) await addExpense(slug, parsed.data);
    revalidatePath(`/${slug}/owner/costs`);
  }
  async function remove(fd: FormData) {
    'use server';
    if (!(await isOwner(slug))) return;
    await deleteExpense(slug, String(fd.get('id')));
    revalidatePath(`/${slug}/owner/costs`);
  }

  const field = { minHeight: 44, borderRadius: 12, border: '1px solid #dde5de', padding: '0 12px', fontSize: 16, background: '#fff', width: '100%', minWidth: 0 } as const;
  return (
    <main className="safe" style={{ padding: '24px 20px 32px', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PeriodBar title="Расходы и прибыль" base={`/${slug}/owner/costs`} period={r.period} today={today} />

      <div style={grid}>
        <Stat label="Выручка" now={r.revenue.cash} before={r.prev.cash} />
        <Stat label="Мастерам" now={r.revenue.master} before={r.prev.master} invert />
        <Stat label="Расходы" now={r.costs.total} before={r.costs.prevTotal} invert />
        <Stat label="Прибыль" now={r.profit} before={r.prevProfit} />
      </div>
      <p className="small muted" style={{ margin: 0, lineHeight: 1.45 }}>Прибыль = выручка − доли мастеров − расходы. Работа хозяйки как мастера целиком остаётся салону.</p>

      <form action={add} className="card stack" style={{ gap: 10 }}>
        <strong>Добавить расход</strong>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          <label className="small stack" style={{ gap: 4 }}>Дата<input name="date" type="date" defaultValue={defaultDate} required style={field} /></label>
          <label className="small stack" style={{ gap: 4 }}>Сумма, сом<input name="amount" inputMode="numeric" required placeholder="например 25000" style={field} /></label>
          <label className="small stack" style={{ gap: 4 }}>На что
            <select name="category" style={field} defaultValue={EXPENSE_CATEGORIES[0]}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="small stack" style={{ gap: 4 }}>Комментарий<input name="note" maxLength={120} placeholder="необязательно" style={field} /></label>
        </div>
        <button type="submit" className="btn primary" style={{ alignSelf: 'flex-start' }}>Добавить</button>
      </form>

      {r.costs.byCategory.length > 0 && (
        <section className="card stack" style={{ gap: 6 }}>
          <strong>По статьям</strong>
          {r.costs.byCategory.map((c) => (
            <div key={c.category} className="row" style={{ justifyContent: 'space-between' }}><span>{c.category}</span><b>{formatSom(c.amount)}</b></div>
          ))}
        </section>
      )}

      <section className="card stack" style={{ gap: 6 }}>
        <strong>Все расходы за период</strong>
        {!r.costs.items.length && <span className="muted">Расходов за этот период пока нет.</span>}
        {r.costs.items.map((c) => (
          <form key={c.id} action={remove} className="row" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
            <input type="hidden" name="id" value={c.id} />
            <span className="small muted" style={{ width: 52, flex: '0 0 auto' }}>{dayMonthShort(c.date)}</span>
            <span className="grow" style={{ minWidth: 0 }}>{c.category}{c.note ? <span className="small muted"> · {c.note}</span> : null}</span>
            <b style={{ whiteSpace: 'nowrap' }}>{formatSom(c.amount)}</b>
            <button type="submit" aria-label={`Удалить расход ${c.category} ${c.amount}`} title="Удалить" style={{ border: 0, background: 'none', color: 'var(--danger)', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>×</button>
          </form>
        ))}
      </section>
    </main>
  );
}
