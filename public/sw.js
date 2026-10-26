// Service worker «Весны»: показывает push-уведомления и обрабатывает кнопку «Подтвердить».
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: 'Весна', body: event.data && event.data.text() }; }
  const actions = d.confirmUrl ? [{ action: 'confirm', title: 'Подтвердить' }] : [];
  event.waitUntil(self.registration.showNotification(d.title || 'Весна', {
    body: d.body || '', icon: '/logo.jpg', badge: '/logo.jpg', tag: d.tag, renotify: !!d.tag,
    data: { url: d.url || '/', confirmUrl: d.confirmUrl || null }, actions,
  }));
});

self.addEventListener('notificationclick', (event) => {
  const { url, confirmUrl } = event.notification.data || {};
  event.notification.close();
  if (event.action === 'confirm' && confirmUrl) {
    event.waitUntil(fetch(confirmUrl, { method: 'POST' }).then(() =>
      self.registration.showNotification('Спасибо, ждём вас!', { body: 'Визит подтверждён.', icon: '/logo.jpg', tag: 'confirmed' })).catch(() => {}));
    return;
  }
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { await c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  })());
});
