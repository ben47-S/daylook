// Service worker Tenues (§5) : reçoit les notifications Web Push et les
// affiche ; un clic ouvre (ou focus) l'app sur la page demandée.

self.addEventListener("push", (event) => {
  let payload = {
    title: "Tenues",
    body: "As-tu repassé la tenue de demain et comptes-tu la porter ?",
    url: "/",
  };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // JSON absent/cassé : on garde le texte brut.
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) return client.focus();
        }
        return clients.openWindow(url);
      }),
  );
});
