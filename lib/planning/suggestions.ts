import { addDays } from "./dates";
import {
  countPlannedElsewhere,
  repetitionWarnings,
  washWarnings,
  type PieceWarning,
  type PlannedPiecesByDay,
} from "./warnings";

// Moteur de propositions du §4 : à partir des associations existantes,
// filtre puis classe pour un jour donné. Fonction pure — testable et
// partagé par la route API ; les alertes colorées sont calculées avec les
// mêmes helpers que l'onglet Planning.

type SuggestionPiece = {
  id: string;
  title: string;
  color: string;
  photoPath: string | null;
  wearsSinceWash: number;
  washThreshold: number | null;
  /** Dernier port réel (WearLog), null si jamais portée. */
  lastWornAt: Date | null;
};

type SuggestionAssociation = {
  id: string;
  top: SuggestionPiece;
  bottom: SuggestionPiece;
};

export type Suggestion = {
  association: SuggestionAssociation;
  warnings: PieceWarning[];
};

type Input = {
  associations: SuggestionAssociation[];
  /** Jour proposé (clé "YYYY-MM-DD"). */
  dateKey: string;
  /** Jours de la semaine affichée (pour le compte de ports prévus). */
  weekKeys: string[];
  /** Pièces déjà programmées par jour (semaine + jours adjacents). */
  planned: PlannedPiecesByDay;
};

/** Pénalité appliquée à une pièce programmée le jour d'avant ou d'après. */
const ADJACENT_PENALTY = 100;

/**
 * Produit les propositions pour `dateKey`, dans l'ordre de pertinence :
 * 1. filtre : une association dont une pièce dépasserait son seuil de
 *    lavage (ports réels + ports déjà prévus dans la semaine) est écartée ;
 * 2. classement : pièces portées le moins souvent, puis depuis le plus
 *    longtemps en premier ; pénalité si une pièce est déjà programmée un
 *    jour adjacent (« on évite de reproposer la même pièce deux jours de
 *    suite », sans l'exure pour autant) ;
 * 3. alertes colorées (orange/rouge) calculées pour chaque proposition.
 */
export function buildSuggestions({
  associations,
  dateKey,
  weekKeys,
  planned,
}: Input): Suggestion[] {
  const scored: Array<{
    suggestion: Suggestion;
    /** Priorité lexicographique : [adjacence, fréquence, ancienneté]. */
    rank: [number, number, number];
  }> = [];

  for (const association of associations) {
    const pieces = [association.top, association.bottom];

    // Filtre seuil de lavage (§4) : le port du jour est inclus.
    const overThreshold = pieces.some((piece) => {
      if (piece.washThreshold === null) return false;
      const plannedElsewhere = countPlannedElsewhere(
        planned,
        weekKeys,
        piece.id,
        dateKey,
      );
      return (
        piece.wearsSinceWash + plannedElsewhere + 1 > piece.washThreshold
      );
    });
    if (overThreshold) continue;

    // Pénalité : pièce déjà programmée la veille ou le lendemain.
    // C'est le critère dominant : on évite surtout les répétitions adjacentes.
    let adjacency = 0;
    for (const piece of pieces) {
      if (planned[addDays(dateKey, -1)]?.includes(piece.id)) {
        adjacency += ADJACENT_PENALTY;
      }
      if (planned[addDays(dateKey, 1)]?.includes(piece.id)) {
        adjacency += ADJACENT_PENALTY;
      }
    }

    // Classement : moins porté d'abord, puis plus ancien port d'abord
    // (timestamp le plus petit = le plus ancien ; jamais portée = 0).
    const frequency = association.top.wearsSinceWash +
      association.bottom.wearsSinceWash;
    const oldest = Math.min(
      association.top.lastWornAt?.getTime() ?? 0,
      association.bottom.lastWornAt?.getTime() ?? 0,
    );

    const warnings = pieces.flatMap((piece) => [
      ...repetitionWarnings(piece, dateKey, planned),
      ...washWarnings(
        piece,
        countPlannedElsewhere(planned, weekKeys, piece.id, dateKey),
      ),
    ]);

    scored.push({
      suggestion: { association, warnings },
      rank: [adjacency, frequency, oldest],
    });
  }

  scored.sort((a, b) => {
    for (let i = 0; i < a.rank.length; i++) {
      if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
    }
    return 0;
  });
  return scored.map((entry) => entry.suggestion);
}
