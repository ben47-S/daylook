"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Historique des ports en bottomsheet (§3, §5) : bouton-icône dans
// l'en-tête du Planning, panneau qui remonte du bas avec les derniers
// ports (jour + haut + pantalon). Fermeture : croix, Échap ou clic sur
// le fond — même motif que le modal photo.

type HistoryEntry = {
  id: string;
  dateKey: string;
  top: { id: string; title: string; color: string };
  bottom: { id: string; title: string; color: string };
};

export function HistorySheet() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Échap ferme le panneau ; on bloque le défilement du fond le temps ou.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function openSheet() {
    setOpen(true);
    if (entries !== null) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/history");
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { history: HistoryEntry[] };
      setEntries(data.history);
    } catch {
      setError("Impossible de charger l'historique.");
    }
    setLoading(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openSheet()}
        aria-label="Ouvrir l'historique des ports"
        className="rounded-lg border border-zinc-300 p-2 text-zinc-600 transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
      </button>

      {open &&
        createPortal(
          <HistoryPanel
            loading={loading}
            error={error}
            entries={entries}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}

function HistoryPanel({
  loading,
  error,
  entries,
  onClose,
}: {
  loading: boolean;
  error: string | null;
  entries: HistoryEntry[] | null;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Historique des ports"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-8"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Historique des ports</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full bg-zinc-100 p-2 text-zinc-600 transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {loading && <p className="text-sm text-zinc-500">Chargement…</p>}

        {!loading && error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {!loading && !error && entries !== null && entries.length === 0 && (
          <p className="text-sm text-zinc-500">
            Aucun port enregistré pour l&apos;instant — confirme une tenue
            sur l&apos;accueil pour l&apos;enregistrer.
          </p>
        )}

        {!loading && !error && entries !== null && entries.length > 0 && (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-0.5 rounded-lg bg-zinc-50 px-3 py-2"
              >
                <p className="text-xs font-medium text-zinc-500">
                  {formatDay(entry.dateKey)}
                </p>
                <p className="truncate text-sm">
                  {pieceLabel(entry.top)} + {pieceLabel(entry.bottom)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Libellé d'une pièce dans l'historique : titre + couleur. */
function pieceLabel(piece: { title: string; color: string }): string {
  return piece.color ? `${piece.title} · ${piece.color}` : piece.title;
}

/** Clé "YYYY-MM-DD" → « lun. 25 nov. » en fr-FR (calé sur UTC). */
function formatDay(dateKey: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}
