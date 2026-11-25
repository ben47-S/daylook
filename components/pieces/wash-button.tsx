"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Bouton « lavé » de la fiche d'une pièce (§4) : remet le compteur de
// ports à zéro via POST /api/pieces/:id/wash puis rafraîchit la page
// serveur pour afficher le compteur remis à zéro.

export function WashButton({ pieceId }: { pieceId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function wash() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/pieces/${pieceId}/wash`, {
      method: "POST",
    });
    setPending(false);
    if (!response.ok) {
      setError("Impossible d'enregistrer le lavage.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => void wash()}
        disabled={pending}
        className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : "Lavé"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
