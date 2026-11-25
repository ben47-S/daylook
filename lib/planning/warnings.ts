import { addDays } from "./dates";

// Alertes colorées à titre informatif sur les propositions ET sur les jours
// déjà planifiés (demande utilisateur) :
//   - orange : la pièce serait portée 2 jours de suite, ou c'est son dernier
//     port avant le seuil de lavage ;
//   - rouge  : la pièce serait portée 3 jours (ou plus) de suite, ou son
//     seuil de lavage serait dépassé.
// Toutes les fonctions sont pures : le moteur de propositions (route API) et
// l'onglet Planning (page serveur) partagent exactement les mêmes règles.

export type PieceWarning = { level: "orange" | "red"; text: string };

type WarnablePiece = {
  id: string;
  title: string;
  washThreshold: number | null;
  wearsSinceWash: number;
};

/** Pièces programmées par jour : { "2026-11-24": [pieceId, pieceId] }. */
export type PlannedPiecesByDay = Record<string, string[]>;

function isPlannedOn(planned: PlannedPiecesByDay, key: string, pieceId: string) {
  return planned[key]?.includes(pieceId) ?? false;
}

/**
 * Alerte de répétition : calcule le nombre de jours consécutifs (avant et
 * après `dateKey`) où cette pièce est programmée.
 */
export function repetitionWarnings(
  piece: WarnablePiece,
  dateKey: string,
  planned: PlannedPiecesByDay,
): PieceWarning[] {
  let before = 0;
  for (let offset = 1; offset <= 2; offset++) {
    if (isPlannedOn(planned, addDays(dateKey, -offset), piece.id)) before++;
    else break;
  }
  let after = 0;
  for (let offset = 1; offset <= 2; offset++) {
    if (isPlannedOn(planned, addDays(dateKey, offset), piece.id)) after++;
    else break;
  }

  const run = 1 + before + after;
  if (run >= 3) {
    return [
      {
        level: "red",
        text: `${piece.title} : ${run} jours de suite`,
      },
    ];
  }
  if (run === 2) {
    return [
      {
        level: "orange",
        text: `${piece.title} : 2 jours de suite`,
      },
    ];
  }
  return [];
}

/**
 * Alerte de lavage : `otherPlannedCount` = ports déjà prévus pour cette
 * pièce dans la semaine, hors `dateKey` (le port du jour est ajouté).
 */
export function washWarnings(
  piece: WarnablePiece,
  otherPlannedCount: number,
): PieceWarning[] {
  if (piece.washThreshold === null) return [];

  const total = piece.wearsSinceWash + otherPlannedCount + 1;
  if (total > piece.washThreshold) {
    return [
      { level: "red", text: `${piece.title} : seuil de lavage dépassé` },
    ];
  }
  if (total === piece.washThreshold) {
    return [
      { level: "orange", text: `${piece.title} : dernier port avant lavage` },
    ];
  }
  return [];
}

/** Nombre de jours (hors `excludeKey`) où la pièce est déjà programmée. */
export function countPlannedElsewhere(
  planned: PlannedPiecesByDay,
  keys: string[],
  pieceId: string,
  excludeKey: string,
): number {
  return keys.reduce((count, key) => {
    if (key === excludeKey) return count;
    return count + (isPlannedOn(planned, key, pieceId) ? 1 : 0);
  }, 0);
}
