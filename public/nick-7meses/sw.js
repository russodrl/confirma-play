self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = {}; }
  const title = data.title || 'Lembrete da festinha do Nick';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Tenho um lembrete da minha festinha para você!',
    tag: data.tag || 'nick-party-reminder',
    renotify: true,
    data: { url: (data.url || '/#eventDetails').startsWith('/#') ? '/nick-7meses/' + (data.url || '/#eventDetails').slice(1) : data.url }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawTarget = event.notification.data?.url || '/nick-7meses/#eventDetails';
  const scopedTarget = rawTarget.startsWith('/#') ? '/nick-7meses/' + rawTarget.slice(1) : rawTarget;
  const target = new URL(scopedTarget, self.location.origin).href;
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if (client.url.startsWith(self.location.origin)) {
        await client.focus();
        return client.navigate(target);
      }
    }
    return clients.openWindow(target);
  })());
});
