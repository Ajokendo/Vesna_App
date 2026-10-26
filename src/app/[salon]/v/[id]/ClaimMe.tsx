'use client';

import { useEffect } from 'react';

/** Ссылка из уведомления открыта на телефоне клиента — запоминаем его для «Мои записи» и «Баллы» */
export default function ClaimMe({ slug, id, token }: { slug: string; id: string; token: string }) {
  useEffect(() => {
    fetch(`/api/${slug}/me`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentId: id, token }) }).catch(() => {});
  }, [slug, id, token]);
  return null;
}
