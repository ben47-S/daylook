"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Piece } from "@/lib/prisma";
import { CompatibleList } from "./compatible-list";

// Associations depuis la carte de la garde-robe ou la fiche d'une pièce :
// un bouton ouvre un bottomsheet avec les cases « Pièces compatibles »
// (§4), pour gérer les combinaisons sans ouvrir la page de détail.
// Même motif que le bottomsheet de l'historique : Échap, clic sur le
// fond, verrouillage du défilement du fond.
//
// Deux variantes : « icon » (bouton rond en surimpression sur la photo
// de la carte) et « block » (bouton pleine largeur sur la fiche).

type Props = {
  /** Pièce de la carte ou de la fiche. */
  piece: { id: string; type: "TOP" | "BOTTOM"; title: string };
  /** « icon » sur une carte, « block » sur la fiche (défaut : icon). */
  variant?: "icon" | "block";
  /** Nombre de combinaisons existantes, affiché sur le bouton « block ». */
  count?: number;
};

export function AssociationsSheet({ piece, variant = "icon", count }: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Piece[] | null>(null);
  const [linkedIds, setLinkedIds] = useState<string[] | null>(null);
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

  // Chargement à chaque ouverture : les coches peuvent avoir bougé depuis
  // la dernière fois. On affiche le contenu déjà en mémoire le temps du
  // rafraîchissement (pas de clignotement « Chargement… » à réouverture).
  async function load() {
    setLoading(options === null);
    setError(null);
    try {
      const [piecesRes, associationsRes] = await Promise.all([
        fetch("/api/pieces"),
        fetch("/api/associations"),
      ]);
      if (!piecesRes.ok || !associationsRes.ok) throw new Error();
      const pieces = (await piecesRes.json()) as { pieces: Piece[] };
      const associations = (await associationsRes.json()) as {
        associations: Array<{ topId: string; bottomId: string }>;
      };

      const opposite = piece.type === "TOP" ? "BOTTOM" : "TOP";
      setOptions(pieces.pieces.filter((option) => option.type === opposite));
      setLinkedIds(
        associations.associations
          .filter(
            (association) =>
              association.topId === piece.id ||
              association.bottomId === piece.id,
          )
          .map((association) =>
            association.topId === piece.id
              ? association.bottomId
              : association.topId,
          ),
      );
    } catch {
      // Seule la première charge est bloquante : sinon on garde l'affichage.
      if (options === null) {
        setError("Impossible de charger les pièces compatibles.");
      }
    }
    setLoading(false);
  }

  async function openSheet() {
    setOpen(true);
    await load();
  }

  // La liste garde son propre état ; on le répercute ici pour que la
  // réouverture du panneau affiche les dernières coches.
  function handleToggle(optionId: string, next: boolean) {
    setLinkedIds((previous) => {
      if (previous === null) return previous;
      const updated = new Set(previous);
      if (next) updated.add(optionId);
      else updated.delete(optionId);
      return [...updated];
    });
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => void openSheet()}
          aria-label={`Gérer les associations de ${piece.title}`}
          title="Gérer les associations"
          className="z-10 rounded-full bg-white/90 p-1.5 text-zinc-700 shadow-sm transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path d="M9 17H7A5 5 0 0 1 7 7h2" />
            <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
            <path d="M8 12h8" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void openSheet()}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium transition hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 lg:max-w-2xl"
        >
          <span className="flex items-center gap-2">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4 text-zinc-500"
            >
              <path d="M9 17H7A5 5 0 0 1 7 7h2" />
              <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
              <path d="M8 12h8" />
            </svg>
            Gérer les associations
            {count !== undefined && (
              <span className="font-normal text-zinc-500">({count})</span>
            )}
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-4 w-4 text-zinc-400"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      )}

      {open &&
        createPortal(
          <AssociationsPanel
            piece={piece}
            options={options}
            linkedIds={linkedIds}
            loading={loading}
            error={error}
            onToggle={handleToggle}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}

function AssociationsPanel({
  piece,
  options,
  linkedIds,
  loading,
  error,
  onToggle,
  onClose,
}: {
  piece: { id: string; type: "TOP" | "BOTTOM"; title: string };
  options: Piece[] | null;
  linkedIds: string[] | null;
  loading: boolean;
  error: string | null;
  onToggle: (optionId: string, next: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Associations de ${piece.title}`}
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
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Pièces compatibles</h2>
            <p className="truncate text-sm text-zinc-500">{piece.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded-full bg-zinc-100 p-2 text-zinc-600 transition hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
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

        {!loading && error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && options !== null && linkedIds !== null && (
          <CompatibleList
            piece={piece}
            options={options}
            linkedIds={linkedIds}
            onToggle={onToggle}
          />
        )}
      </div>
    </div>
  );
}
