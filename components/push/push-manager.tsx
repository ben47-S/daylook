"use client";

import { useEffect } from "react";

// Enregistrement du service worker + abonnement Web Push (§5).
// Monté une fois dans le layout des onglets :
//   1. register /sw.js ;
//   2. demande la permission de notification (si elle est déjà refusée,
//      on ne réinsiste pas — l'alerte in-app reste) ;
//   3. subscribe avec la clé publique VAPID puis POST /api/push/subscribe.
// Best effort : chaque étape peut être bloquée par le navigateur, on
// n'affiche jamais d'erreur à l'utilisateur (l'app fonctionne sans push).

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushManager() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (typeof Notification === "undefined") return;

    let cancelled = false;

    async function setup() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");

        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted" || cancelled) return;
        } else if (Notification.permission !== "granted") {
          return; // refusée : on n'insiste pas, l'alerte in-app suffit
        }

        const applicationServerKey = urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
        );
        if (applicationServerKey.length === 0) return;

        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
          }));

        if (cancelled) return;
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
      } catch {
        // Navigateur sans push / réseau : silencieux, l'app reste utilisable.
      }
    }

    void setup();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
