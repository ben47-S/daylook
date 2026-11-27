"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Enregistrement du service worker + abonnement Web Push (§5).
// Monté une fois dans le layout des onglets :
//   1. register /sw.js ;
//   2. demande la permission UNIQUEMENT au clic sur le bouton (obligatoire
//      sur iOS : WebKit n'affiche le prompt que lors d'une interaction
//      directe — un appel automatique au chargement est ignoré) ;
//   3. subscribe avec la clé publique VAPID puis POST /api/push/subscribe.
// Si la permission est déjà accordée, l'abonnement se fait silencieusement.
// Best effort : chaque étape peut être bloquée par le navigateur, on
// n'affiche jamais d'erreur bloquante (l'alerte in-app reste disponible).

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type Status = "checking" | "needed" | "enabled" | "denied" | "unsupported";

export function PushManager() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const subscribe = useCallback(
    async (registration: ServiceWorkerRegistration) => {
      const applicationServerKey = urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
      );
      if (applicationServerKey.length === 0) return false;

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
        }));

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      return true;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        typeof Notification === "undefined" ||
        !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      ) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        if (cancelled) return;
        registrationRef.current = registration;
        if (Notification.permission === "granted") {
          const ok = await subscribe(registration).catch(() => false);
          if (!cancelled) setStatus(ok ? "enabled" : "unsupported");
        } else if (Notification.permission === "denied") {
          if (!cancelled) setStatus("denied");
        } else if (!cancelled) {
          setStatus("needed");
        }
      } catch {
        if (!cancelled) setStatus("unsupported");
      }
    }

    void setup();
    return () => {
      cancelled = true;
    };
  }, [subscribe]);

  // Le clic est le geste utilisateur exigé par iOS : requestPermission()
  // doit être appelée en premier, avant tout await.
  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "needed");
        return;
      }
      const registration =
        registrationRef.current ?? (await navigator.serviceWorker.ready);
      const ok = await subscribe(registration);
      setStatus(ok ? "enabled" : "unsupported");
    } catch {
      setStatus("needed");
    } finally {
      setBusy(false);
    }
  }

  if (status !== "needed" && status !== "denied") return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
      {status === "denied" ? (
        <p className="min-w-0 flex-1 text-zinc-600">
          Notifications désactivées — réactive-les dans Réglages › Notifications
          › Tenues.
        </p>
      ) : (
        <>
          <p className="min-w-0 flex-1 text-zinc-600">
            Recevoir les rappels de tenue le soir ?
          </p>
          <button
            type="button"
            onClick={() => void enable()}
            disabled={busy}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
          >
            {busy ? "Activation…" : "Activer les notifications"}
          </button>
        </>
      )}
    </div>
  );
}
