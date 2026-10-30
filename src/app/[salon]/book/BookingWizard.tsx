'use client';

import Link from 'next/link';
import PushOptIn from '@/app/PushOptIn';
import ClientNav from '@/app/ClientNav';
import InstallCard from '@/app/InstallCard';
import { refreshManifest } from '@/app/AppBonus';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Catalog } from '@/server/salon';
import type { HairLength } from '@/db/schema';
import { formatPrice, formatSom, quote, resolveService, plural } from '@/lib/pricing';
import { addDays, dayMonth, dayMonthShort, daysBetween, hhmm, weekdayFull, weekdayShort } from '@/lib/time';
import Hints from '@/app/Hints';
import { useLang, useT } from '@/app/Lang';
import { durationIn, scheduleIn } from '@/lib/i18n';
import PrepayNotice from '@/app/PrepayNotice';
import { useRouter } from 'next/navigation';

type Props = {
  welcomeBonus?: number;
  slug: string; salonName: string; address: string; today: string; horizonDays: number;
  initialHall: 'MEN' | 'WOMEN'; catalog: Catalog;
  /** Запись к мастеру, выбранному на главной: шаг «Выберите мастера» пропускается */
  presetStaffId?: string | null;
  /** Открыто по ссылке из листа ожидания: услуга и день уже выбраны (шаг «Дата и время») */
  preset?: { serviceId: string; date: string; any: boolean; length: HairLength | null; addonIds: string[] } | null;
  /** Телефон уже знает клиента — имя и номер подставляются */
  me?: { name: string; phone: string } | null;
};

const LENGTHS: { id: HairLength; name: string; cm: string }[] = [
  { id: 'SHORT', name: 'Короткие', cm: 'до 15 см' },
  { id: 'MEDIUM', name: 'Средние', cm: 'до 30 см' },
  { id: 'LONG', name: 'Длинные', cm: 'до 45 см' },
  { id: 'XLONG', name: 'Очень длинные', cm: 'от 45 см' },
];

const TITLES = ['', 'Выберите услугу', 'Выберите мастера', 'Дата и время', 'Подтверждение'];

export default function BookingWizard({ slug, salonName, address, today, horizonDays, initialHall, catalog, welcomeBonus = 0, presetStaffId = null, preset = null, me = null }: Props) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [fixed, setFixed] = useState<string | null>(presetStaffId);
  const fixedMaster = fixed ? catalog.staff.find((m) => m.id === fixed) ?? null : null;
  const [step, setStep] = useState(preset && (presetStaffId || preset.any) ? 3 : 1);
  const [hall, setHall] = useState<'MEN' | 'WOMEN'>(initialHall);
  const [forChild, setForChild] = useState(false);
  const [child, setChild] = useState<{ name: string; age: number | null }>({ name: '', age: null });
  const [length, setLength] = useState<HairLength>(preset?.length ?? 'MEDIUM');
  const [serviceId, setServiceId] = useState<string | null>(preset?.serviceId ?? null);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [addonIds, setAddonIds] = useState<string[]>(preset?.addonIds ?? []);
  const [staffId, setStaffId] = useState<string | null>(presetStaffId ?? (preset?.any ? 'any' : null));
  const [weekStart, setWeekStart] = useState(preset ? addDays(today, Math.floor(daysBetween(today, preset.date) / 7) * 7) : today);
  const [week, setWeek] = useState<{ date: string; available: boolean }[] | null>(null);
  const [date, setDate] = useState<string | null>(preset?.date ?? null);
  const [slots, setSlots] = useState<{ minute: number; staffId: string }[] | null>(null);
  const [slot, setSlot] = useState<{ minute: number; staffId: string } | null>(null);
  const [client, setClient] = useState(me ? { name: me.name, phone: me.phone || '+996 ' } : { name: '', phone: '+996 ' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { total: number; totalMax: number | null; staffName: string; id: string; token: string; prepay: { amount: number; due: string; details: string | null } | null }>(null);

  const childAge = forChild ? child.age : null;

  // разделы, где работает выбранный мастер (или все)
  const ofMaster = (c: Catalog['categories'][number]) => !fixed || c.staffIds.includes(fixed);
  const bothHalls = catalog.categories.some((c) => c.hall === 'MEN' && ofMaster(c)) && catalog.categories.some((c) => c.hall === 'WOMEN' && ofMaster(c));
  const categories = useMemo(() => catalog.categories.filter((c) => c.hall === hall && (forChild ? c.forKids : !c.forKids) && (!fixed || c.staffIds.includes(fixed))), [catalog, hall, forChild, fixed]);
  const hasKids = catalog.categories.some((c) => c.forKids && ofMaster(c));

  const items = useMemo(() => categories.map((c) => ({
    ...c,
    services: c.services
      .filter((v) => v.ageMin == null || (childAge != null && childAge >= v.ageMin && childAge <= (v.ageMax ?? 99)))
      .filter((v) => !fixed || !v.onlyStaffIds.length || v.onlyStaffIds.includes(fixed))
      .map((v) => ({ ...v, resolved: resolveService(v, c.byLength ? length : null) }))
      .filter((v) => v.resolved),
  })).filter((c) => c.services.length), [categories, length, childAge, fixed]);

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

  const query = (extra: Record<string, string>, staff = staffId) => {
    const p = new URLSearchParams({ serviceId: serviceId!, staffId: staff!, ...extra });
    if (category?.byLength) p.set('length', length);
    if (addonIds.length) p.set('addons', addonIds.join(','));
    return `/api/${slug}/slots?${p}`;
  };
  // Загрузка с запасом: график недели и свободное время запрашиваются заранее (как только выбраны услуга и мастер),
  // а при переходе на шаг «Дата и время» берутся из памяти — без ожидания. Память живёт 1 минуту
  const cache = useRef(new Map<string, { at: number; p: Promise<{ days?: { date: string; available: boolean }[]; slots?: { minute: number; staffId: string }[] }> }>());
  const load = (url: string) => {
    const hit = cache.current.get(url);
    if (hit && Date.now() - hit.at < 60_000) return hit.p;
    const p = fetch(url).then((r) => r.json()).catch(() => ({}));
    cache.current.set(url, { at: Date.now(), p });
    return p;
  };

  // заранее: выбрана услуга — график «любого мастера»; выбран мастер — его график (ещё до «Далее»)
  useEffect(() => {
    if (!serviceId) return;
    load(query({ week: weekStart }, 'any'));
    if (staffId) load(query({ week: weekStart }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, staffId, length, addonIds.join(',')]);

  useEffect(() => {
    if (step !== 3 || !serviceId || !staffId) return;
    let cancelled = false;
    setWeek(null);
    load(query({ week: weekStart })).then((d) => {
      if (cancelled) return;
      setWeek(d.days ?? []);
      // и свободное время на доступные дни — чтобы день открывался сразу
      for (const x of d.days ?? []) if (x.available) load(query({ date: x.date }));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, weekStart, serviceId, staffId, length, addonIds.join(',')]);

  useEffect(() => {
    if (step !== 3 || !date) return;
    let cancelled = false;
    setSlots(null);
    load(query({ date })).then((d) => { if (!cancelled) setSlots(d.slots ?? []); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, date]);

  const resetFrom = (level: 'service' | 'staff' | 'date') => {
    if (level === 'service') { setServiceId(null); setAddonIds([]); }
    if (level !== 'date') setStaffId(fixed);
    setDate(null); setSlot(null); setSlots(null);
  };

  const childOk = !forChild || (child.name.trim().length > 1 && childAge != null && childAge >= 0);
  const canNext = (step === 1 && !!serviceId && childOk) || (step === 2 && !!staffId) || (step === 3 && !!slot);
  // с выбранным мастером шага 2 нет: 1 → 3, назад 3 → 1
  const next = () => setStep(fixed && step === 1 ? 3 : step + 1);
  const back = () => setStep(fixed && step === 3 ? 1 : step - 1);
  const total = fixed ? 3 : 4;
  const shown = fixed && step > 2 ? step - 1 : step;
  function dropMaster() { setFixed(null); setStaffId(null); setServiceId(null); setAddonIds([]); setDate(null); setSlot(null); setSlots(null); setStep(1); }
  const lastWeekStart = addDays(today, Math.floor((horizonDays - 1) / 7) * 7);

  async function submit() {
    if (!serviceId || !slot || !date) return;
    setSending(true); setError(null);
    const res = await fetch(`/api/${slug}/appointments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId, staffId: slot.staffId, length: category?.byLength ? length : null, addonIds, date, minute: slot.minute,
        client, forChild: forChild && child.age ? { name: child.name.trim(), age: child.age } : null, payment: 'salon',
      }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { setError(data.error ? t(data.error) : t('Не получилось записаться')); return; }
    refreshManifest();
    cache.current.clear(); router.refresh(); // новые данные в «Мои записи» и в свободном времени
    setDone({ total: data.quote.total, totalMax: data.quote.totalMax, staffName: staffName(data.staffId), id: data.id, token: data.visitToken, prepay: data.prepay ?? null });
  }

  if (done && date && slot) {
    return (
      <main className="app home">
        <div className="page" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 48, flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 4px #fff, 0 0 0 5.5px var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </div>
          <h1 style={{ fontSize: 26 }}>{t('Вы записаны!')}</h1>
          {done.prepay && <PrepayNotice amount={done.prepay.amount} due={done.prepay.due} details={done.prepay.details} />}
          <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
            {t(category?.name ?? '')}: {t(service?.name ?? '').toLowerCase()}<br />
            {done.staffName} · {weekdayFull(date, lang)}, {dayMonth(date, lang)}, {hhmm(slot.minute)}
          </p>
          <div className="card stack" style={{ width: '100%', textAlign: 'left' }}>
            <div className="row"><span className="grow muted">{t('К оплате в салоне')}</span><strong>{formatPrice(done.total, done.totalMax)}</strong></div>
            <div className="row"><span className="grow muted">{t('Адрес')}</span><strong>{address}</strong></div>
          </div>
          <InstallCard bonus={welcomeBonus} />
          <PushOptIn slug={slug} appointmentId={done.id} token={done.token} />
          <Link href={`/${slug}/my`} className="btn block">{t('Мои записи')}</Link>
        </div>
        <ClientNav slug={slug} inline />
      </main>
    );
  }

  return (
    // экран ровно на высоту телефона: прокручивается только список посередине, низ (итог и меню) всегда на месте
    <main className="app home">
      <div className="page" style={{ paddingBottom: 12, flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', gap: 14 }}>
        <header className="row">
          {step === 1 ? (
            <Link href={`/${slug}`} className="btn" aria-label={t('Назад')} style={{ width: 44, padding: 0 }}>‹</Link>
          ) : (
            <button type="button" className="btn" aria-label={t('Назад')} style={{ width: 44, padding: 0 }} onClick={back}>‹</button>
          )}
          <div className="grow">
            <div className="small muted" style={{ fontWeight: 600 }}>{salonName} · {t('шаг {a} из {b}', { a: shown, b: total })}</div>
            <h1 style={{ fontSize: 21 }}>{t(TITLES[step])}</h1>
          </div>
        </header>
        <div className="progress">{Array.from({ length: total }, (_, i) => i + 1).map((n) => <span key={n} className={n <= shown ? 'on' : ''} />)}</div>
        {fixedMaster && step < 4 && (
          <div className="card row" style={{ gap: 10, padding: '8px 12px', borderColor: 'var(--gold)' }}>
            <span className="avatar" style={{ width: 40, height: 40, fontSize: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {fixedMaster.photoUrl ? <img src={fixedMaster.photoUrl} alt="" /> : fixedMaster.name[0]}
            </span>
            <span className="grow stack" style={{ gap: 0, minWidth: 0 }}>
              <span className="small muted">{t('Мастер')}</span>
              <strong>{fixedMaster.name}</strong>
            </span>
            <button type="button" className="small" onClick={dropMaster} style={{ border: 0, background: 'none', color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer' }}>{t('другой мастер')}</button>
          </div>
        )}

        {step === 1 && (
          <>
            {(!fixed || hasKids) && (
            <div className="stack">
              <strong>{t('Для кого')}</strong>
              <div className="grid2">
                <button type="button" className="choice center" aria-pressed={!forChild} onClick={() => { setForChild(false); resetFrom('service'); }}>
                  <strong>{t('Для себя')}</strong>
                </button>
                <button type="button" className="choice center" aria-pressed={forChild} onClick={() => { setForChild(true); resetFrom('service'); }}>
                  <strong>{t('Для ребёнка')}</strong><span className="small muted">{t('цена по возрасту')}</span>
                </button>
              </div>
              {forChild && (
                <div className="stack" style={{ gap: 8 }}>
                  <label className="field">{t('Имя ребёнка')}<input value={child.name} onChange={(e) => setChild({ ...child, name: e.target.value })} autoComplete="off" /></label>
                  <span className="small" style={{ fontWeight: 700 }}>{t('Сколько лет')}</span>
                  {/* возраст — прокруткой, без даты рождения */}
                  <div role="radiogroup" aria-label={t('Сколько лет')} style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollSnapType: 'x mandatory' }}>
                    {Array.from({ length: 17 }, (_, i) => i + 1).map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={child.age === n} onClick={() => { setChild({ ...child, age: n }); resetFrom('service'); }}
                        style={{ flex: '0 0 auto', minWidth: 46, minHeight: 46, borderRadius: 12, border: `1.5px solid ${child.age === n ? 'var(--accent)' : 'var(--line)'}`, background: child.age === n ? 'var(--accent)' : '#fff', color: child.age === n ? '#fff' : 'var(--ink)', fontWeight: 800, fontSize: 16, cursor: 'pointer', scrollSnapAlign: 'start' }}>{n}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}

            {bothHalls && (
              <div className="tabs" role="group" aria-label={t('Зал')}>
                <button type="button" aria-pressed={hall === 'MEN'} onClick={() => { setHall('MEN'); resetFrom('service'); }}>{t('Мужской зал')}</button>
                <button type="button" aria-pressed={hall === 'WOMEN'} onClick={() => { setHall('WOMEN'); resetFrom('service'); }}>{t('Женский зал')}</button>
              </div>
            )}

            {!forChild && catalog.categories.some((c) => c.hall === hall && c.byLength) && (
              <div className="stack">
                <strong>{t('Длина волос')}</strong>
                <div className="grid4">
                  {LENGTHS.map((l) => (
                    <button key={l.id} type="button" className="choice center" style={{ padding: '6px 2px', minHeight: 56 }} aria-pressed={length === l.id}
                      onClick={() => { setLength(l.id); resetFrom('service'); }}>
                      <strong style={{ fontSize: 13, lineHeight: 1.15 }}>{t(l.name)}</strong><span className="small muted" style={{ fontSize: 11 }}>{t(l.cm)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {forChild && childAge == null && <div className="note">{t('Укажите возраст — цена детской стрижки зависит от него.')}</div>}
            {forChild && childAge != null && items.length === 0 && <div className="note">{t('Для этого возраста детских услуг нет — выберите «Для себя».')}</div>}

            {items.map((c) => {
              const expanded = openCat === c.id || items.length === 1;
              const from = Math.min(...c.services.map((v) => v.resolved!.price));
              return (
              <section key={c.id} className="card stack" style={expanded ? undefined : { padding: 0 }}>
                <button type="button" aria-expanded={expanded} onClick={() => setOpenCat(expanded ? null : c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'none', border: 0, padding: expanded ? 0 : '12px 16px', cursor: 'pointer', textAlign: 'left' }}>
                  <span className="grow stack" style={{ gap: 2 }}>
                    <span style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 17 }}>{t(c.name)}</span>
                    <span className="small muted">{c.note ? `${t(c.note)} · ` : ''}{c.services.length} {t(c.services.length === 1 ? 'услуга' : c.services.length < 5 ? 'услуги' : 'услуг')} · {t('от')} {formatSom(from)}</span>
                  </span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {expanded && c.services.map((v) => (
                  <button key={v.id} type="button" className="choice" aria-pressed={serviceId === v.id}
                    onClick={() => { if (serviceId !== v.id) { setServiceId(v.id); setAddonIds([]); resetFrom('staff'); } }}>
                    <span className="grow stack" style={{ gap: 2 }}>
                      <strong style={{ fontSize: 15 }}>{t(v.name)}</strong>
                      <span className="small muted">{v.resolved!.durationLabel ? durationIn(lang, v.resolved!.durationLabel) : `≈ ${v.resolved!.durationMin} ${t('мин')}`}</span>
                    </span>
                    <strong style={{ whiteSpace: 'nowrap' }}>{formatPrice(v.resolved!.price, v.resolved!.priceMax)}</strong>
                  </button>
                ))}
                {expanded && c.id === category?.id && c.addons.length > 0 && (
                  <div className="stack" style={{ gap: 6 }}>
                    <span className="small muted" style={{ fontWeight: 800 }}>{t('Добавить к услуге')}</span>
                    {c.addons.map((a) => {
                      const on = addonIds.includes(a.id);
                      return (
                        <label key={a.id} className="row card" style={{ padding: '10px 12px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={on} onChange={() => setAddonIds(on ? addonIds.filter((x) => x !== a.id) : [...addonIds, a.id])} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />
                          <span className="grow stack" style={{ gap: 0 }}>
                            <strong style={{ fontSize: 14 }}>{t(a.name)}</strong>
                            {a.rule === 'FREE_IF_REPEAT' && <span className="small" style={{ color: 'var(--accent-dark)', fontWeight: 700 }}>{t('Бесплатно, если прошлый раз делали у нас')}</span>}
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
            {category && /краск/i.test(category.note ?? '') && <div className="note">{t('Цена за работу. Краска оплачивается отдельно, по расходу.')}</div>}
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
                    <strong style={{ fontSize: 16 }}>{m ? m.name : t('Любой свободный мастер')}</strong>
                    <span className="small muted">{m ? t(m.title ?? '') : t('Подберём мастера на ваше время')}</span>
                    {m?.rating && <span className="small" style={{ color: '#B7860F', fontWeight: 800 }}>★ {m.rating.avg.toFixed(1).replace('.', ',')} · {m.rating.count} {t(plural(m.rating.count, 'оценка', 'оценки', 'оценок'))}</span>}
                    {m && <span className="small muted">{scheduleIn(lang, m.scheduleLabel)}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="btn" style={{ width: 44, padding: 0 }} aria-label={t('Предыдущая неделя')} disabled={weekStart <= today}
                onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
              <strong>{dayMonthShort(weekStart, lang)} — {dayMonthShort(addDays(weekStart, 6), lang)}</strong>
              <button type="button" className="btn" style={{ width: 44, padding: 0 }} aria-label={t('Следующая неделя')} disabled={weekStart >= lastWeekStart}
                onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
            </div>
            <div className="grid7">
              {(week ?? Array.from({ length: 7 }, (_, i) => ({ date: addDays(weekStart, i), available: false }))).map((d) => (
                <button key={d.date} type="button" className="choice center" style={{ minHeight: 64, padding: 0 }}
                  disabled={!week || d.date < today || daysBetween(today, d.date) >= horizonDays} aria-pressed={date === d.date}
                  data-busy={week && !d.available ? '1' : undefined}
                  aria-label={`${weekdayFull(d.date, lang)}, ${dayMonth(d.date, lang)}${d.available ? '' : ', ' + t('нет свободного времени')}`}
                  onClick={() => { setDate(d.date); setSlot(null); }}>
                  <span className="small" style={{ fontWeight: 600 }}>{weekdayShort(d.date, lang)}</span>
                  <strong style={{ fontSize: 17 }}>{Number(d.date.slice(8))}</strong>
                </button>
              ))}
            </div>
            <span className="small muted">{t('Запись открыта на {n} дней вперёд. Бледные дни — выходной мастера или всё занято: нажмите на день, чтобы встать в лист ожидания.', { n: horizonDays })}</span>
            {!date ? (
              <div className="card muted" style={{ textAlign: 'center', borderStyle: 'dashed' }}>{week ? t('Выберите день') : t('Загружаем график…')}</div>
            ) : (
              <div className="stack">
                <div className="row"><strong className="grow">{weekdayFull(date, lang)}, {dayMonth(date, lang)}</strong><span className="small muted">≈ {q?.durationMin} {t('мин')}</span></div>
                {slots == null ? <span className="muted">{t('Загружаем свободное время…')}</span> : slots.length === 0 ? (
                  <>
                    <span className="muted">{t('В этот день свободного времени нет.')}</span>
                    <WaitOffer slug={slug} key={date} payload={{ serviceId: serviceId!, staffId: staffId!, date, length: category?.byLength ? length : null, addonIds }} client={client} setClient={setClient} prominent
                      who={staffId === 'any' ? t('у любого мастера') : t('у мастера {name}', { name: staffName(staffId ?? '') })} />
                  </>
                ) : (
                  [[t('Утро'), 0, 12 * 60], [t('День'), 12 * 60, 17 * 60], [t('Вечер'), 17 * 60, 24 * 60]].map(([label, from, to]) => {
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
                {slots && slots.length > 0 && (
                  <WaitOffer slug={slug} key={`w${date}`} payload={{ serviceId: serviceId!, staffId: staffId!, date, length: category?.byLength ? length : null, addonIds }} client={client} setClient={setClient}
                    who={staffId === 'any' ? t('у любого мастера') : t('у мастера {name}', { name: staffName(staffId ?? '') })} />
                )}
              </div>
            )}
          </>
        )}

        {step === 4 && q && date && slot && (
          <>
            <section className="card stack">
              <strong style={{ fontSize: 16 }}>{t(category?.name ?? '')}: {t(service?.name ?? '').toLowerCase()}</strong>
              <span className="muted">{staffName(slot.staffId)} · {weekdayShort(date, lang)}, {dayMonth(date, lang)}, {hhmm(slot.minute)}</span>
              {forChild && <span className="muted">{t('Для: {name}, {age} лет', { name: child.name, age: childAge ?? '' })}</span>}
              <div style={{ height: 1, background: 'var(--line)' }} />
              <div className="row"><span className="grow muted">{t(service?.name ?? '')}</span><strong>{formatPrice(q.base, q.baseMax)}</strong></div>
              {q.addons.map((a) => (
                <div key={a.id} className="row"><span className="grow muted">{t(a.name)}</span><strong>+{formatSom(a.price)}</strong></div>
              ))}
              <div className="row" style={{ fontSize: 18 }}><strong className="grow">{t('Итого')}</strong><strong style={{ fontFamily: 'var(--serif)' }}>{q.isRange ? t('от') + ' ' : ''}{formatSom(q.total)}</strong></div>
              {q.isRange && <div className="note">{t('Точную цену мастер назовёт после консультации.')}</div>}
              {addons.some((a) => a.rule === 'FREE_IF_REPEAT') && <div className="note">{t('Если прошлый раз вы делали это у нас, снятие будет бесплатным — пересчитаем автоматически.')}</div>}
            </section>

            <section className="stack">
              <strong>{t('Ваши контакты')}</strong>
              <label className="field">{t('Имя')}<input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} autoComplete="name" /></label>
              <label className="field">{t('Телефон (WhatsApp)')}<input type="tel" inputMode="tel" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} autoComplete="tel" /></label>
              <span className="small muted">{t('Пришлём подтверждение и напоминания. Оплата — в салоне: наличными, картой или по QR.')}</span>
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
                {step === 1 ? (service ? t(category?.name ?? '') : t('Ничего не выбрано')) : step === 2 ? t(service?.name ?? '') : staffId === 'any' ? t('Любой мастер') : staffName(staffId ?? '')}
              </span>
              <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {step === 1 ? (q ? `${t(service?.name ?? '')} · ${q.isRange ? t('от') + ' ' : ''}${formatSom(q.total)}` : t('Выберите услугу'))
                  : step === 2 ? (staffId ? (staffId === 'any' ? t('Любой свободный') : staffName(staffId)) : t('Выберите мастера'))
                    : (slot && date ? `${weekdayShort(date, lang)}, ${dayMonth(date, lang)}, ${hhmm(slot.minute)}` : t('Выберите время'))}
              </strong>
            </div>
            <button type="button" className="btn primary" disabled={!canNext} onClick={next}>{t('Далее')}</button>
          </>
        ) : (
          <button type="button" className="btn primary block" disabled={sending || client.name.trim().length < 2 || client.phone.replace(/\D/g, '').length < 9} onClick={submit}>
            {sending ? t('Записываем…') : t('Записаться')}
          </button>
        )}
      </div>
      <ClientNav slug={slug} inline />
    </main>
  );
}


type WaitPayload = { serviceId: string; staffId: string; date: string; length: HairLength | null; addonIds: string[] };

/** «Сообщите, если освободится»: заявка в лист ожидания на выбранный день */
function WaitOffer({ slug, payload, client, setClient, who, prominent }: {
  slug: string; payload: WaitPayload; client: { name: string; phone: string };
  setClient: (c: { name: string; phone: string }) => void; who: string; prominent?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function join() {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/${slug}/waitlist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, client }) });
    setBusy(false);
    if (!res.ok) { setErr(((e: string | undefined) => (e ? t(e) : t('Не получилось')))((await res.json().catch(() => ({}))).error)); return; }
    refreshManifest();
    setDone(true);
  }
  if (done) {
    return (
      <div className="note" style={{ lineHeight: 1.45 }}>
        ✓ {t('Вы в листе ожидания на {date}. Если время {who} освободится, пришлём уведомление — и администратор тоже увидит вашу заявку. Заявка — в «Моих записях».', { date: `${weekdayShort(payload.date, lang)}, ${dayMonth(payload.date, lang)}`, who })}
        <div style={{ marginTop: 8 }}><PushOptIn slug={slug} compact /></div>
      </div>
    );
  }
  if (!open) {
    return prominent ? (
      <button type="button" className="btn primary" onClick={() => setOpen(true)} style={{ alignSelf: 'flex-start' }}>🔔 {t('Сообщите, если освободится')}</button>
    ) : (
      <button type="button" className="small" onClick={() => setOpen(true)} style={{ alignSelf: 'flex-start', border: 0, background: 'none', padding: 0, color: 'var(--accent-dark)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
        {t('Нет подходящего времени? Сообщить, если освободится другое')}
      </button>
    );
  }
  return (
    <div className="card stack" style={{ gap: 8, borderColor: 'var(--gold)' }}>
      <strong>🔔 {t('Лист ожидания')} — {weekdayShort(payload.date, lang)}, {dayMonth(payload.date, lang)}</strong>
      <Hints items={[['🔔', t('Освободится время {who} — сразу пришлём уведомление', { who })], ['👀', t('Администратор тоже увидит заявку')]]} />
      <label className="field">{t('Имя')}<input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} autoComplete="name" /></label>
      <label className="field">{t('Телефон (WhatsApp)')}<input type="tel" inputMode="tel" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} autoComplete="tel" /></label>
      {err && <div className="error" role="alert">{err}</div>}
      <div className="row">
        <button type="button" className="btn" onClick={() => setOpen(false)}>{t('Отмена')}</button>
        <button type="button" className="btn primary grow" disabled={busy || client.name.trim().length < 2 || client.phone.replace(/\D/g, '').length < 9} onClick={join}>{busy ? '…' : t('Встать в лист ожидания')}</button>
      </div>
    </div>
  );
}
