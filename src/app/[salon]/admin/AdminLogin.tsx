'use client';

import { useActionState } from 'react';

/** Вход администратора: PIN и понятная ошибка (неверный PIN, блокировка после 5 попыток) */
export default function AdminLogin({ action }: { action: (prev: string | null, fd: FormData) => Promise<string | null> }) {
  const [error, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="page" style={{ justifyContent: 'center', maxWidth: 360, margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: 24 }}>Вход администратора</h1>
      <label className="field">PIN-код<input name="pin" type="password" inputMode="numeric" autoComplete="current-password" required autoFocus /></label>
      {error && <div className="error" role="alert">{error}</div>}
      <button type="submit" className="btn primary block" disabled={pending}>{pending ? 'Проверяем…' : 'Войти'}</button>
    </form>
  );
}

/** Первый вход в новый салон: код настройки от разработчика и новый PIN администратора */
export function AdminSetup({ action }: { action: (prev: string | null, fd: FormData) => Promise<string | null> }) {
  const [error, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="page" style={{ justifyContent: 'center', maxWidth: 380, margin: '0 auto', width: '100%' }}>
      <h1 style={{ fontSize: 24 }}>Добро пожаловать!</h1>
      <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>Это первый вход в приложение салона. Введите код настройки, который вам прислали, и придумайте PIN администратора (4–6 цифр).</p>
      <label className="field">Код настройки<input name="code" autoCapitalize="characters" autoComplete="off" required placeholder="XXXXX-XXXXX" /></label>
      <label className="field">PIN администратора<input name="pin" type="password" inputMode="numeric" pattern="\d{4,6}" required /></label>
      <label className="field">PIN ещё раз<input name="pin2" type="password" inputMode="numeric" pattern="\d{4,6}" required /></label>
      {error && <div className="error" role="alert">{error}</div>}
      <button type="submit" className="btn primary block" disabled={pending}>{pending ? 'Сохраняем…' : 'Начать'}</button>
    </form>
  );
}
