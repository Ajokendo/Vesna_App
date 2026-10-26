'use client';

import Link from 'next/link';
import PushOptIn from '@/app/PushOptIn';
import ClientNav from '@/app/ClientNav';
import InstallCard from '@/app/InstallCard';
import { refreshManifest } from '@/app/AppBonus';
import { useEffect, useMemo, useState } from 'react';
import type { Catalog } from '@/server/salon';
import type { HairLength } from '@/db/schema';
import { ageOn, formatPrice, formatSom, quote, resolveService } from '@/lib/pricing';
import { addDays, dayMonth, dayMonthShort, daysBetween, hhmm, weekdayFull, weekdayShort } from '@/lib/time';

type Props = {
  welcomeBonus?: number;
  slug: string; salonName: string; address: string; today: string; horizonDays: number;
  initialHall: 'MEN' | 'WOMEN'; catalog: Catalog;
};

const LENGTHS: { id: HairLength; name: string; cm: string }[] = [
  { id: 'SHORT', name: 'Короткие', cm: 'до 15 см' },
  { id: 'MEDIUM', name: 'Средние', cm: 'до 30 см' },
  { id: 'LONG', name: 'Длинные', cm: 'до 45 см' },
  { id: 'XLONG', name: 'Очень длинные', cm: 'от 45 см' },
];

const TITLES = ['', 'Выберите услугу', 'Выберите мастера', 'Дата и время', 'Подтверждение'];

export default function BookingWizard({ slug, salonName, address, today, horizonDays, initialHall, catalog, welcomeBonus = 0 }: Props) {
  const [step, setStep] = useState(1);
  const [hall, setHall] = useState<'MEN' | 'WOMEN'>(initialHall);
  const [forChild, setForChild] = useState(false);
  const [child, setChild] = useState({ name: '', birthDate: '' });
  const [length, setLength] = useState<HairLength>('MEDIUM');
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(today);
  const [week, setWeek] = useState<{ date: string; available: boolean }[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ minute: number; staffId: string }[] | null>(null);
  const [slot, setSlot] = useState<{ minute: number; staffId: string } | null>(null);
  const [client, setClient] = useState({ name: '', phone: '+996 ' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { total: number; totalMax: number | null; staffName: string; id: string; token: string }>(null);

  const childAge = forChild && child.birthDate ? ageOn(child.birthDate, today) : null;

  const bothHalls = catalog.categories.some((c) => c.hall === 'MEN') && catalog.categories.some((c) => c.hall === 'WOMEN');
  const categories = useMemo(() => catalog.categories.filter((c) => c.hall === hall && (forChild ? c.forKids : !c.forKids)), [catalog, hall, forChild]);

  const items = useMemo(() => categories.map((c) => ({
    ...c,
    services: c.services
      .filter((v) => v.ageMin == null || (childAge != null && childAge >= v.ageMin && childAge <= (v.ageMax ?? 99)))
      .map((v) => ({ ...v, resolved: resolveService(v, c.byLength ? length : null) }))
      .filter((v) => v.resolved),
  })).filter((c) => c.services.length), [categories, length, childAge]);

  const category = catalog.categories.find((c) => c.services.some((v) => v.id === serviceId));
  const service = category?.services.find((v) => v.id === serviceId);
  const resolved = service ? resolveService(service, category?.byLength ? length : null) : null;
  const addons = category?.addons.filter((a) => addonIds.includes(a.id)) ?? [];
  const q = resolved ? quote({ service: resolved, addons: addons.map((a) => ({ ...a, rule: a.rule ?? null })) }) : null;

  const masters = useMemo(() => {
    if (!category || !service) return [];
    const ok = category.staffIds.filter((id) => !service.onlyStaffIds.length || service.onlyStaffIds.includes(id));
    return catalog.staff.filter((m) => ok.includes(m.id));
  }, [catalog, category, service]);
  const staffName = (id: string) => catalog.staff.find((m) => m.id === id)?.name ?? '';

  const query = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ serviceId: serviceId!, staffId: staffId!, ...extra });
    if (category?.byLength) p.set('length', length);
    if (addonIds.length) p.set('addons', addonIds.join(','));
    return `/api/${slug}/slots?${p}`;
  };

  useEffect(() => {
    if (step !== 3 || !serviceId || !staffId) return;
    let cancelled = false;
    setWeek(null);
    fetch(query({ week: weekStart })).then((r) => r.json()).then((d) => { if (!cancelled) setWeek(d.days ?? []); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, weekStart, serviceId, staffId, length, addonIds.join(',')]);

  useEffect(() => {
    if (step !== 3 || !date) return;
    let cancelled = false;
    setSlots(null);
    fetch(query({ date })).then((r) => r.json()).then((d) => { if (!cancelled) setSlots(d.slots ?? []); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, date]);

  const resetFrom = (level: 'service' | 'staff' | 'date') => {
    if (level === 'service') { setServiceId(null); setAddonIds([]); }
    if (level !== 'date') setStaffId(null);
    setDate(null); setSlot(null); setSlots(null);
  };

  const childOk = !forChild || (child.name.trim().length > 1 && childAge != null && childAge >= 0);
  const canNext = (step === 1 && !!serviceId && childOk) || (step === 2 && !!staffId) || (step === 3 && !!slot);
  const lastWeekStart = addDays(today, Math.floor((horizonDays - 1) / 7) * 7);

  async function submit() {
    if (!serviceId || !slot || !date) return;
    setSending(true); setError(null);
    const res = await fetch(`/api/${slug}/appointments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId, staffId: slot.staffId, length: category?.byLength ? length : null, addonIds, date, minute: slot.minute,
        client, forChild: forChild ? child : null, payment: 'salon',
      }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { setError(data.error ?? 'Не получилось записаться'); return; }
    refreshManifest();
    setDone({ total: data.quote.total, totalMax: data.quote.totalMax, staffName: staffName(data.staffId), id: data.id, token: data.visitToken });
  }

  if (done && date && slot) {
    return (
      <main className="app">
        <div className="page" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 48 }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 4px #fff, 0 0 0 5.5px var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </div>
          <h1 style={{ fontSize: 26 }}>Вы записаны!</h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
            {category?.name}: {service?.name.toLowerCase()}<br />
            {done.staffName} · {weekdayFull(date)}, {dayMonth(date)}, {hhmm(slot.minute)}
          </p>
          <div className="card stack" style={{ width: '100%', textAlign: 'left' }}>
            <div className="row"><span className="grow muted">К оплате в салоне</span><strong>{formatPrice(done.total, done.totalMax)}</strong></div>
            <div className="row"><span className="grow muted">Адрес</span><strong>{address}</strong></div>
          </div>
          <InstallCard bonus={welcomeBonus} />
          <PushOptIn slug={slug} appointmentId={done.id} token={done.token} />
          <Link href={`/${slug}/my`} className="btn block">Мои записи</Link>
        </div>
        <ClientNav slug={slug} />
      </main>
    );
  }

  return (
    <main className="app">
      <div className="page" style={{ paddingBottom: 12 }}>
        <header className="row">
          {step === 1 ? (
            <Link href={`/${slug}`} className="btn" aria-label="Назад" style={{ width: 44, padding: 0 }}>‹</Link>
          ) : (
            <button type="button" className="btn" aria-label="Назад" style={{ width: 44, padding: 0 }} onClick={() => setStep(step - 1)}>‹</button>
          )}
          <div className="grow">
            <div className="small muted" style={{ fontWeight: 600 }}>{salonName} · шаг {step} из 4</div>
            <h1 style={{ fontSize: 21 }}>{TITLES[step]}</h1>
          </div>
        </header>
        <div className="progress">{[1, 2, 3, 4].map((n) => <span key={n} className={n <= step ? 'on' : ''} />)}</div>

        {step === 1 && (
          <>
            <div className="stack">
              <strong>Для кого</strong>
              <div className="grid2">
                <button type="button" className="choice center" aria-pressed={!forChild} onClick={() => { setForChild(false); resetFrom('service'); }}>
                  <strong>Для себя</strong>
                </button>
                <button type="button" className="choice center" aria-pressed={forChild} onClick={() => { setForChild(true); resetFrom('service'); }}>
                  <strong>Для ребёнка</strong><span className="small muted">цена по возрасту</span>
                </button>
              </div>
              {forChild && (
                <div className="grid2">
                  <label className="field">Имя ребёнка<input value={child.name} onChange={(e) => setChild({ ...child, name: e.target.value })} autoComplete="off" /></label>
                  <label className="field">Дата рождения<input type="date" value={child.birthDate} max={today} onChange={(e) => { setChild({ ...child, birthDate: e.target.value }); resetFrom('service'); }} /></label>
                </div>
              )}
            </div>

            {bothHalls && (
              <div className="tabs" role="group" aria-label="Зал">
                <button type="button" aria-pressed={hall === 'MEN'} onClick={() => { setHall('MEN'); resetFrom('service'); }}>Мужской зал</button>
                <button type="button" aria-pressed={hall === 'WOMEN'} onClick={() => { setHall('WOMEN'); resetFrom('service'); }}>Женский зал</button>
              </div>
            )}

            {!forChild && catalog.categories.some((c) => c.hall === hall && c.byLength) && (
              <div className="stack">
                <strong>Длина волос</strong>
                <div className="grid4">
                  {LENGTHS.map((l) => (
                    <button key={l.id} type="button" className="choice center" style={{ padding: '6px 2px', minHeight: 56 }} aria-pressed={length === l.id}
                      onClick={() => { setLength(l.id); resetFrom('service'); }}>
                      <strong style={{ fontSize: 13, lineHeight: 1.15 }}>{l.name}</strong><span className="small muted" style={{ fontSize: 11 }}>{l.cm}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {forChild && childAge == null && <div className="note">Укажите дату рождения — цена детской стрижки зависит от возраста.</div>}
            {forChild && childAge != null && items.length === 0 && <div className="note">Для этого возраста детских услуг нет — выберите «Для себя».</div>}

            {items.map((c) => {
              const expanded = openCat === c.id || items.length === 1;
              const from = Math.min(...c.services.map((v) => v.resolved!.price));
              return (
              <section key={c.id} className="card stack" style={expanded ? undefined : { padding: 0 }}>
                <button type="button" aria-expanded={expanded} onClick={() => setOpenCat(expanded ? null : c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 0, padding: expanded ? 0 : 16, cursor: 'pointer', textAlign: 'left' }}>
                  <span className="grow stack" style={{ gap: 2 }}>
                    <span style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 18 }}>{c.name}</span>
                    <span className="small muted">{c.note ? `${c.note} · ` : ''}{c.services.length} {c.services.length === 1 ? 'услуга' : c.services.length < 5 ? 'услуги' : 'услуг'} · от {formatSom(from)}</span>
                  </span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {expanded && c.services.map((v) => (
                  <button key={v.id} type="button" className="choice" aria-pressed={serviceId === v.id}
                    onClick={() => { if (serviceId !== v.id) { setServiceId(v.id); setAddonIds([]); resetFrom('staff'); } }}>
                    <span className="grow stack" style={{ gap: 2 }}>
                      <strong style={{ fontSize: 15 }}>{v.name}</strong>
                      <span className="small muted">{v.resolved!.durationLabel ?? `≈ ${v.resolved!.durationMin} мин`}</span>
                    </span>
                    <strong style={{ whiteSpace: 'nowrap' }}>{formatPrice(v.resolved!.price, v.resolved!.priceMax)}</strong>
                  </button>
                ))}
                {expanded && c.id === category?.id && c.addons.length > 0 && (
                  <div className="stack" style={{ gap: 6 }}>
                    <span className="small muted" style={{ fontWeight: 800 }}>Добавить к услуге</span>
                    {c.addons.map((a) => {
                      const on = addonIds.includes(a.id);
                      return (
                        <label key={a.id} className="row card" style={{ padding: '10px 12px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={on} onChange={() => setAddonIds(on ? addonIds.filter((x) => x !== a.id) : [...addonIds, a.id])} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
                          <span className="grow stack" style={{ gap: 0 }}>
                            <strong style={{ fontSize: 14 }}>{a.name}</strong>
                            {a.rule === 'FREE_IF_REPEAT' && <span className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>Бесплатно, если прошлый раз делали у нас</span>}
                          </span>
                          <strong>+{formatSom(a.price)}</strong>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>
              );
            })}
            {category && /краск/i.test(category.note ?? '') && <div className="note">Цена за работу. Краска оплачивается отдельно, по расходу.</div>}
          </>
        )}

        {step === 2 && (
          <div className="stack">
            {[...masters, null].map((m) => {
              const id = m ? m.id : 'any';
              return (
                <button key={id} type="button" className="choice" style={{ padding: 14, borderRadius: 20 }} aria-pressed={staffId === id}
                  onClick={() => { setStaffId(id); resetFrom('date'); }}>
                  <span className="avatar">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {m?.photoUrl ? <img src={m.photoUrl} alt={m.name} /> : m ? m.name[0] : '?'}
                  </span>
                  <span className="grow stack" style={{ gap: 2 }}>
                    <strong style={{ fontSize: 16 }}>{m ? m.name : 'Любой свободный мастер'}</strong>
                    <span className="small muted">{m ? m.title : 'Подберём мастера на ваше время'}</span>
                    {m && <span className="small muted">{m.scheduleLabel}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="btn" style={{ width: 44, padding: 0 }} aria-label="Предыдущая неделя" disabled={weekStart <= today}
                onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
              <strong>{dayMonthShort(weekStart)} — {dayMonthShort(addDays(weekStart, 6))}</strong>
              <button type="button" className="btn" style={{ width: 44, padding: 0 }} aria-label="Следующая неделя" disabled={weekStart >= lastWeekStart}
                onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
            </div>
            <div className="grid7">
              {(week ?? Array.from({ length: 7 }, (_, i) => ({ date: addDays(weekStart, i), available: false }))).map((d) => (
                <button key={d.date} type="button" className="choice center" style={{ minHeight: 64, padding: 0 }}
                  disabled={!week || !d.available || daysBetween(today, d.date) >= horizonDays} aria-pressed={date === d.date}
                  aria-label={`${weekdayFull(d.date)}, ${dayMonth(d.date)}${d.available ? '' : ', нет свободного времени'}`}
                  onClick={() => { setDate(d.date); setSlot(null); }}>
                  <span className="small" style={{ fontWeight: 600 }}>{weekdayShort(d.date)}</span>
                  <strong style={{ fontSize: 17 }}>{Number(d.date.slice(8))}</strong>
                </button>
              ))}
            </div>
            <span className="small muted">Запись открыта на {horizonDays} дней вперёд. Серые дни — выходной мастера или всё занято.</span>
            {!date ? (
              <div className="card muted" style={{ textAlign: 'center', borderStyle: 'dashed' }}>{week ? 'Выберите день' : 'Загружаем график…'}</div>
            ) : (
              <div className="stack">
                <div className="row"><strong className="grow">{weekdayFull(date)}, {dayMonth(date)}</strong><span className="small muted">≈ {q?.durationMin} мин</span></div>
                {slots == null ? <span className="muted">Загружаем свободное время…</span> : slots.length === 0 ? <span className="muted">В этот день свободного времени нет.</span> : (
                  [['Утро', 0, 12 * 60], ['День', 12 * 60, 17 * 60], ['Вечер', 17 * 60, 24 * 60]].map(([label, from, to]) => {
                    const part = slots.filter((t) => t.minute >= (from as number) && t.minute < (to as number));
                    if (!part.length) return null;
                    return (
                      <div key={label} className="stack" style={{ gap: 6 }}>
                        <span className="small muted" style={{ fontWeight: 800 }}>{label}</span>
                        <div className="grid4">
                          {part.map((t) => (
                            <button key={t.minute} type="button" className="choice center" style={{ minHeight: 44, padding: 0 }}
                              aria-pressed={slot?.minute === t.minute} onClick={() => setSlot(t)}>
                              <strong>{hhmm(t.minute)}</strong>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}

        {step === 4 && q && date && slot && (
          <>
            <section className="card stack">
              <strong style={{ fontSize: 16 }}>{category?.name}: {service?.name.toLowerCase()}</strong>
              <span className="muted">{staffName(slot.staffId)} · {weekdayShort(date)}, {dayMonth(date)}, {hhmm(slot.minute)}</span>
              {forChild && <span className="muted">Для: {child.name}, {childAge} лет</span>}
              <div style={{ height: 1, background: 'var(--line)' }} />
              <div className="row"><span className="grow muted">{service?.name}</span><strong>{formatPrice(q.base, q.baseMax)}</strong></div>
              {q.addons.map((a) => (
                <div key={a.id} className="row"><span className="grow muted">{a.name}</span><strong>+{formatSom(a.price)}</strong></div>
              ))}
              <div className="row" style={{ fontSize: 18 }}><strong className="grow">Итого</strong><strong style={{ fontFamily: 'var(--serif)' }}>{q.isRange ? 'от ' : ''}{formatSom(q.total)}</strong></div>
              {q.isRange && <div className="note">Точную цену мастер назовёт после консультации.</div>}
              {addons.some((a) => a.rule === 'FREE_IF_REPEAT') && <div className="note">Если прошлый раз вы делали это у нас, снятие будет бесплатным — пересчитаем автоматически.</div>}
            </section>

            <section className="stack">
              <strong>Ваши контакты</strong>
              <label className="field">Имя<input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} autoComplete="name" /></label>
              <label className="field">Телефон (WhatsApp)<input type="tel" inputMode="tel" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} autoComplete="tel" /></label>
              <span className="small muted">Пришлём подтверждение и напоминания. Оплата — в салоне: наличными, картой или по QR.</span>
            </section>
            {error && <div className="error" role="alert">{error}</div>}
          </>
        )}
      </div>

      <div className="bar">
        {step < 4 ? (
          <>
            <div className="grow stack" style={{ gap: 0, minWidth: 0 }}>
              <span className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {step === 1 ? (service ? category?.name : 'Ничего не выбрано') : step === 2 ? service?.name : staffId === 'any' ? 'Любой мастер' : staffName(staffId ?? '')}
              </span>
              <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {step === 1 ? (q ? `${service?.name} · ${q.isRange ? 'от ' : ''}${formatSom(q.total)}` : 'Выберите услугу')
                  : step === 2 ? (staffId ? (staffId === 'any' ? 'Любой свободный' : staffName(staffId)) : 'Выберите мастера')
                    : (slot && date ? `${weekdayShort(date)}, ${dayMonth(date)}, ${hhmm(slot.minute)}` : 'Выберите время')}
              </strong>
            </div>
            <button type="button" className="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Далее</button>
          </>
        ) : (
          <button type="button" className="btn primary block" disabled={sending || client.name.trim().length < 2 || client.phone.replace(/\D/g, '').length < 9} onClick={submit}>
            {sending ? 'Записываем…' : 'Записаться'}
          </button>
        )}
      </div>
      <ClientNav slug={slug} />
    </main>
  );
}

