// FitTracker Pro — Service Worker für Push-Benachrichtigungen
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Kommt vom Server (Netlify Function), auch wenn die App geschlossen ist
self.addEventListener("push", (event) => {
  let data = { title: "FitTracker Pro", body: "Erinnerung" };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body || "",
    icon: data.icon || undefined,
    badge: data.badge || undefined,
    tag: data.tag || data.title,
    renotify: true,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(data.title || "FitTracker Pro", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
