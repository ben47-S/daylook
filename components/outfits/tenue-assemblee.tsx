"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { Piece } from "@/lib/prisma";

// Vue assemblée : un haut au-dessus d'un pantalon, chaque pièce sur toute
// la largeur (lignes empilées). Photo-agnostic — sans photo on affiche
// titre + couleur. La photo apparaît en petite vignette cliquable qui
// ouvre un modal avec la photo en grand (fermeture : croix, Échap ou clic
// sur le fond).

type PieceVisuelle = Pick<
  Piece,
  "id" | "title" | "color" | "photoPath" | "wearsSinceWash" | "washThreshold"
>;

export function TenueAssemblee({
  top,
  bottom,
}: {
  top: PieceVisuelle;
  bottom: PieceVisuelle;
}) {
  const [zoomed, setZoomed] = useState<PieceVisuelle | null>(null);

  // Échap ferme le modal ; on bloque le défilement du fond le temps ou.
  useEffect(() => {
    if (!zoomed) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setZoomed(null);
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [zoomed]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <PieceRow piece={top} label="Haut" onZoom={setZoomed} />
        <PieceRow piece={bottom} label="Pantalon" onZoom={setZoomed} />
      </div>

      {zoomed !== null &&
        createPortal(
          <PhotoModal piece={zoomed} onClose={() => setZoomed(null)} />,
          document.body,
        )}
    </>
  );
}

/** Une pièce = une ligne pleine largeur : vignette photo + titre/couleur. */
function PieceRow({
  piece,
  label,
  onZoom,
}: {
  piece: PieceVisuelle;
  label: string;
  onZoom: (piece: PieceVisuelle) => void;
}) {
  return (
    <div className="flex w-full items-center gap-3 rounded-lg bg-zinc-50 p-2.5">
      {piece.photoPath ? (
        <button
          type="button"
          onClick={() => onZoom(piece)}
          aria-label={`Agrandir la photo : ${piece.title}`}
          className="shrink-0 cursor-zoom-in overflow-hidden rounded-lg bg-zinc-200 transition hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          <Image
            src={`/api/photos/${piece.id}?cutout=1`}
            alt={piece.title}
            unoptimized
            width={96}
            height={128}
            className="block h-14 w-10 object-cover sm:h-16 sm:w-12"
          />
        </button>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{piece.title}</span>
        <span className="truncate text-xs text-zinc-500">
          {piece.color} · {label}
          {piece.washThreshold !== null ? (
            <span
              className={
                piece.wearsSinceWash >= piece.washThreshold
                  ? " font-medium text-red-600"
                  : undefined
              }
            >
              {" "}
              · {piece.wearsSinceWash}/{piece.washThreshold} ports
            </span>
          ) : (
            <span> · {piece.wearsSinceWash} port(s)</span>
          )}
        </span>
      </div>
    </div>
  );
}

/** Modal plein écran : la photo en grand + titre. */
function PhotoModal({
  piece,
  onClose,
}: {
  piece: PieceVisuelle;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={piece.title}
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-2xl flex-col items-center gap-3"
      >
        <Image
          src={`/api/photos/${piece.id}?cutout=1`}
          alt={piece.title}
          unoptimized
          width={1024}
          height={1365}
          className="max-h-[75vh] max-w-full rounded-xl object-contain"
        />
        <div className="text-center text-white">
          <p className="text-sm font-medium">{piece.title}</p>
          <p className="text-xs text-zinc-300">{piece.color}</p>
        </div>
      </div>
    </div>
  );
}
