self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { title: 'New Roadside Booking', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'New Roadside Booking';
  const options = {
    body: payload.body || 'A new booking has been received.',
    icon: payload.icon || '/images/brand/problem-solvers-icon.png',
    badge: payload.badge || '/images/brand/problem-solvers-icon.png',
    tag: payload.tag || 'roadside-booking',
    renotify: true,
    data: payload.data || { url: '/dashboard/requests' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/dashboard/requests', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existingClient = windowClients.find((client) => client.url.startsWith(self.location.origin));
      if (existingClient) {
        return existingClient.navigate(targetUrl).then(() => existingClient.focus());
      }
      return clients.openWindow(targetUrl);
    })
  );
});
