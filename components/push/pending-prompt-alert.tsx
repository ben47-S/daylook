"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Alerte « repassée ? » à l'ouverture de l'app (§5) : appelle
// GET /api/pending-prompt (qui envoie aussi les notifications dues) et
// affiche la question en attente, même sans avoir cliqué sur la
// notification. Elle se met à jour toutes les minutes (les questions du
// soir arrivent entre 20h et 23h) et disparaît dès qu'on répond — la
// question reste visible sur l'Accueil sous forme de carte.

type PromptState =
  | { pending: false; snoozedUntil?: string | null }
  | {
      pending: true;
      dateKey: string;
      dayQuestion: string;
      topTitle: string;
      snoozedUntil?: string | null;
    };

export function PendingPromptAlert() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const response = await fetch("/api/pending-prompt");
        if (!response.ok || !active) return;
        const data = (await response.json()) as PromptState;
        if (active) {
          setPrompt(data);
          if (!data.pending) setDismissed(false);
        }
      } catch {
        // Réseau indisponible : on réessaiera au prochain cycle.
      }
    }

    void check();
    const timer = setInterval(() => void check(), 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (!prompt?.pending || dismissed) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
    >
      <p className="min-w-0 flex-1 text-sm font-medium text-amber-800">
        As-tu repassé {prompt.dayQuestion} ({prompt.topTitle}) et comptes-tu la
        porter ?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            router.push("/");
          }}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Répondre
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
        >
          Masquer
        </button>
      </div>
    </div>
  );
}
