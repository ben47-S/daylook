"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanStatus } from "@/lib/prisma";
import type { PieceWarning } from "@/lib/planning/warnings";
import { TenueAssemblee } from "@/components/outfits/tenue-assemblee";
import { StatusBadge } from "@/components/planning/status-badge";

// Onglet Planning : la semaine, un jour par ligne (§3), statut de chaque
// tenue, alertes colorées orange/rouge, et choix d'une tenue parmi les
// propositions (§4) via un panneau déplié sous le jour.
//
// Structure : une ligne par jour à TOUTES les tailles — jour+statut à
// gauche, carte de tenue au milieu (haut au-dessus de pantalon, pleine
// largeur de la colonne, photos en vignettes cliquables → modal) et
// boutons empilés verticalement à droite. Le panneau de propositions se
// découpe en 2 puis 3 colonnes à partir de md.

type PieceMini = {
  id: string;
  title: string;
  color: string;
  photoPath: string | null;
  wearsSinceWash: number;
  washThreshold: number | null;
};

export type DayPlan = {
  dateKey: string;
  label: string;
  status: PlanStatus | null;
  top: PieceMini | null;
  bottom: PieceMini | null;
  warnings: PieceWarning[];
};

type SuggestionItem = {
  association: { id: string; top: PieceMini; bottom: PieceMini };
  warnings: PieceWarning[];
};

const BUTTON =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-60";

export function WeekView({ days }: { days: DayPlan[] }) {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleSuggestions(dateKey: string) {
    if (openKey === dateKey) {
      setOpenKey(null);
      return;
    }
    setOpenKey(dateKey);
    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const response = await fetch(`/api/planning/${dateKey}/suggestions`);
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { suggestions: SuggestionItem[] };
      setSuggestions(data.suggestions);
    } catch {
      setError("Impossible de charger les propositions.");
    }
    setLoading(false);
  }

  async function choose(dateKey: string, associationId: string) {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/planning/${dateKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ associationId }),
    });
    setPending(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      setError(data.message ?? "Erreur lors de l'enregistrement.");
      return;
    }
    setOpenKey(null);
    router.refresh();
  }

  async function remove(dateKey: string) {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/planning/${dateKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ associationId: null }),
    });
    setPending(false);
    if (!response.ok) {
      setError("Impossible de retirer la tenue.");
      return;
    }
    setOpenKey(null);
    router.refresh();
  }

  return (
    // Borne la ligne-jour sur très grand écran : jour | tenue | actions
    // reste lisible au lieu de s'étaler sur 72rem.
    <div className="mx-auto flex w-full max-w-none flex-col gap-3 lg:max-w-4xl">
      <ul className="flex flex-col gap-3">
        {days.map((day) => {
          const open = openKey === day.dateKey;
          const hasOutfit = day.top !== null && day.bottom !== null;
          const actionLabel = open
            ? "Fermer"
            : hasOutfit
              ? "Changer"
              : "Choisir";

          return (
            <li
              key={day.dateKey}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
            >
              {/* Une seule ligne à toutes les tailles : jour+statut |
                  carte de tenue | boutons empilés verticalement. */}
              <div className="flex items-start gap-2 p-3 sm:gap-3 md:gap-5">
                {/* Jour + statut */}
                <div className="flex w-16 shrink-0 flex-col gap-1 sm:w-28 md:w-44">
                  <p className="truncate text-xs font-medium leading-tight sm:text-sm">
                    {day.label}
                  </p>
                  {day.status && <StatusBadge status={day.status} />}
                </div>

                {/* Carte : haut au-dessus de pantalon, alertes en dessous */}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {hasOutfit ? (
                    <>
                      <TenueAssemblee top={day.top!} bottom={day.bottom!} />
                      <Warnings warnings={day.warnings} />
                    </>
                  ) : (
                    <p className="text-xs text-zinc-400 sm:text-sm">
                      Aucune tenue prévue pour ce jour.
                    </p>
                  )}
                </div>

                {/* Boutons : empilés verticalement à droite */}
                <div className="flex w-20 shrink-0 flex-col gap-1.5 sm:w-24 md:w-28">
                  {hasOutfit && (
                    <button
                      type="button"
                      onClick={() => void remove(day.dateKey)}
                      disabled={pending}
                      className={`${BUTTON} w-full text-center`}
                    >
                      Retirer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void toggleSuggestions(day.dateKey)}
                    disabled={pending}
                    className={`${BUTTON} w-full text-center`}
                  >
                    {actionLabel}
                  </button>
                </div>
              </div>

              {open && (
                <div className="border-t border-zinc-100 bg-zinc-50/60 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Propositions pour ce jour
                  </p>

                  {loading && (
                    <p className="text-sm text-zinc-500">
                      Calcul des propositions…
                    </p>
                  )}

                  {!loading && error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}

                  {!loading && !error && suggestions.length === 0 && (
                    <p className="text-sm text-zinc-500">
                      Aucune proposition — crée d&apos;abord des combinaisons
                      dans la garde-robe.
                    </p>
                  )}

                  {!loading && !error && suggestions.length > 0 && (
                    <ul className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                      {suggestions.map((suggestion) => (
                        <li
                          key={suggestion.association.id}
                          className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-2.5"
                        >
                          <TenueAssemblee
                            top={suggestion.association.top}
                            bottom={suggestion.association.bottom}
                          />
                          <Warnings warnings={suggestion.warnings} />
                          <button
                            type="button"
                            onClick={() =>
                              void choose(
                                day.dateKey,
                                suggestion.association.id,
                              )
                            }
                            disabled={pending}
                            className={`${BUTTON} self-start`}
                          >
                            {pending ? "Enregistrement…" : "Choisir"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {error && openKey === null && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** Alertes colorées : orange = attention, rouge = sérieux (§4 + demandes). */
function Warnings({ warnings }: { warnings: PieceWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="flex flex-col gap-0.5">
      {warnings.map((warning) => (
        <li
          key={warning.text}
          className={`text-xs font-medium ${
            warning.level === "red" ? "text-red-600" : "text-amber-600"
          }`}
        >
          • {warning.text}
        </li>
      ))}
    </ul>
  );
}
