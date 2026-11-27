// Alertes colorées à titre informatif sur les propositions ET sur les jours
// déjà planifiés (demande utilisateur) :
//   - orange : la pièce serait portée 2 fois dans la semaine, ou c'est son
//     dernier port avant le seuil de lavage ;
//   - rouge  : la pièce serait portée 3 fois (ou plus) dans la semaine, ou son
//     seuil de lavage serait dépassé.
// Deux comptages distincts et complémentaires :
//   - hebdomadaire : nombre de jours où la pièce est programmée dans la
//     semaine lundi → dimanche affichée ;
//   - cumulé : `wearsSinceWash`, nombre de ports réels depuis le dernier
//     lavage (une pièce peut être portée une fois cette semaine puis trois
//     fois les suivantes avant d'atteindre son seuil).
// Toutes les fonctions sont pures : le moteur de propositions (route API) et
// l'onglet Planning (page serveur) partagent exactement les mêmes règles.

export type PieceWarning = { level: "orange" | "red"; text: string };

type WarnablePiece = {
  id: string;
  title: string;
  color: string;
  washThreshold: number | null;
  wearsSinceWash: number;
};

/** Pièces programmées par jour : { "2026-11-24": [pieceId, pieceId] }. */
export type PlannedPiecesByDay = Record<string, string[]>;

function isPlannedOn(planned: PlannedPiecesByDay, key: string, pieceId: string) {
  return planned[key]?.includes(pieceId) ?? false;
}

/** Libellé des alertes : le titre de la pièce, suivi de sa couleur. */
function pieceLabel(piece: { title: string; color: string }): string {
  return piece.color ? `${piece.title} · ${piece.color}` : piece.title;
}

/**
 * Alerte de répétition hebdomadaire : nombre de fois où la pièce serait
 * portée dans la semaine, le jour `dateKey` inclus.
 */
export function weeklyWarnings(
  piece: WarnablePiece,
  dateKey: string,
  weekKeys: string[],
  planned: PlannedPiecesByDay,
): PieceWarning[] {
  const count = countPlannedElsewhere(planned, weekKeys, piece.id, dateKey) + 1;
  if (count >= 3) {
    return [
      {
        level: "red",
        text: `${pieceLabel(piece)} : ${count} fois cette semaine`,
      },
    ];
  }
  if (count === 2) {
    return [
      {
        level: "orange",
        text: `${pieceLabel(piece)} : 2 fois cette semaine`,
      },
    ];
  }
  return [];
}

/**
 * Alerte de lavage (comptage cumulé depuis le lavage) :
 * `otherPlannedCount` = ports déjà prévus pour cette pièce dans la semaine,
 * hors `dateKey` (le port du jour est ajouté).
 */
export function washWarnings(
  piece: WarnablePiece,
  otherPlannedCount: number,
): PieceWarning[] {
  if (piece.washThreshold === null) return [];

  const total = piece.wearsSinceWash + otherPlannedCount + 1;
  if (total > piece.washThreshold) {
    return [
      { level: "red", text: `${pieceLabel(piece)} : seuil de lavage dépassé` },
    ];
  }
  if (total === piece.washThreshold) {
    return [
      {
        level: "orange",
        text: `${pieceLabel(piece)} : dernier port avant lavage`,
      },
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
