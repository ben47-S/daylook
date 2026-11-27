"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { Piece } from "@/lib/prisma";

// Cases à cocher « Pièces compatibles » (§4) : chaque coche crée une
// association, chaque décoche la retire. Appels à /api/associations.

type Props = {
  /** La pièce de la fiche (ou du bottomsheet d'associations). */
  piece: { id: string; type: "TOP" | "BOTTOM" };
  /** Pièces de l'autre type, actives. */
  options: Piece[];
  /** Ids des options déjà associées à la pièce de la fiche. */
  linkedIds: string[];
  /** Remonte un changement de coche au parent (bottomsheet). */
  onToggle?: (optionId: string, next: boolean) => void;
};

export function CompatibleList({
  piece,
  options,
  linkedIds,
  onToggle,
}: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<string>>(new Set(linkedIds));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function toggle(optionId: string, next: boolean) {
    const previous = new Set(checked);
    if (next) checked.add(optionId);
    else checked.delete(optionId);
    setChecked(new Set(checked)); // optimiste
    setMessage(null);
    setPending(true);

    const topId = piece.type === "TOP" ? piece.id : optionId;
    const bottomId = piece.type === "TOP" ? optionId : piece.id;

    const response = await fetch("/api/associations", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topId, bottomId }),
    });

    if (!response.ok) {
      setChecked(previous); // annulation de l'optimiste
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      setMessage(data.message ?? "Erreur lors de la mise à jour.");
    } else {
      onToggle?.(optionId, next); // le parent répercute la coche
    }

    setPending(false);
    router.refresh(); // rafraîchit les combinaisons affichées sur la fiche
  }

  function handleChange(
    event: ChangeEvent<HTMLInputElement>,
    optionId: string,
  ) {
    void toggle(optionId, event.target.checked);
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Aucune pièce compatible — ajoute des{" "}
        {piece.type === "TOP" ? "pantalons" : "hauts"} dans la garde-robe.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 lg:max-w-2xl">
      <ul className="flex flex-col gap-2">
        {options.map((option) => (
          <li key={option.id}>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-lg border bg-white px-3 py-2.5 transition ${
                checked.has(option.id)
                  ? "border-zinc-900"
                  : "border-zinc-200 hover:border-zinc-400"
              } ${pending ? "opacity-60" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked.has(option.id)}
                disabled={pending}
                onChange={(event) => handleChange(event, option.id)}
                className="h-4 w-4 shrink-0 accent-zinc-900"
              />
              <Vignette piece={option} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {option.title}
              </span>
              <span className="shrink-0 text-xs text-zinc-500">
                {option.color}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {message && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {message}
        </p>
      )}
    </div>
  );
}

// Vignette carrée de la pièce, à gauche du titre (même source que la
// garde-robe : /api/photos/:id, qui renvoie la photo locale ou une URL
// signée R2). Sans photo : un cadre neutre garde la ligne alignée.
function Vignette({ piece }: { piece: Piece }) {
  if (!piece.photoPath) {
    return (
      <div
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-4 w-4 text-zinc-300"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 15 4.5-4.5 3 3L15 9l6 6" />
          <circle cx="8.5" cy="9.5" r="1.25" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={`/api/photos/${piece.id}`}
      alt={piece.title}
      unoptimized
      width={36}
      height={36}
      className="h-9 w-9 shrink-0 rounded-md border border-zinc-200 object-cover"
    />
  );
}
