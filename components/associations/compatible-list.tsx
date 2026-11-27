"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
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
