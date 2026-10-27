'use client';

import { useActionState } from 'react';

type Action = (prev: string | null, fd: FormData) => Promise<string | null>;

/** Вход хозяйки по её PIN */
export function OwnerLogin({ action }: { action: Action }) {
  const [error, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="page" style={{ justifyContent: 'center', maxWidth: 360, margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: 24 }}>Кабинет хозяйки</h1>
      <p className="muted" style={{ margin: 0 }}>Выручка, зарплата мастерам, расходы и прибыль.</p>
      <label className="field">PIN хозяйки<input name="pin" type="password" inputMode="numeric" autoComplete="current-password" required autoFocus /></label>
      {error && <div className="error" role="alert">{error}</div>}
      <button type="submit" className="btn primary block" disabled={pending}>{pending ? 'Проверяем…' : 'Войти'}</button>
    </form>
  );
}

/** Первый раз: хозяйка (уже вошедшая как администратор) придумывает свой PIN */
export function OwnerSetup({ action }: { action: Action }) {
  const [error, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="page" style={{ justifyContent: 'center', maxWidth: 380, margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: 24 }}>PIN хозяйки</h1>
      <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
        Придумайте PIN (4–6 цифр), который знаете только вы. Он открывает отчёты о выручке, зарплатах мастеров и прибыли.
        Он должен отличаться от PIN администратора — тогда администратор эти отчёты не увидит.
      </p>
      <label className="field">Новый PIN хозяйки<input name="pin" type="password" inputMode="numeric" pattern="\d{4,6}" required autoFocus /></label>
      <label className="field">PIN ещё раз<input name="pin2" type="password" inputMode="numeric" pattern="\d{4,6}" required /></label>
      {error && <div className="error" role="alert">{error}</div>}
      <button type="submit" className="btn primary block" disabled={pending}>{pending ? 'Сохраняем…' : 'Сохранить и войти'}</button>
    </form>
  );
}
