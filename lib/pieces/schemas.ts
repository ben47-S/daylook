import * as z from "zod";

// Schéma de validation des pièces, partagé entre les route handlers
// (validation serveur) et le formulaire client (types d'erreurs).

export const pieceSchema = z.object({
  type: z.enum(["TOP", "BOTTOM"], {
    error: "Choisissez Haut ou Pantalon.",
  }),
  title: z
    .string()
    .trim()
    .min(1, { error: "Le titre est requis." })
    .max(80, { error: "Titre trop long (80 caractères max)." }),
  color: z
    .string()
    .trim()
    .min(1, { error: "La couleur est requise." })
    .max(40, { error: "Couleur trop longue (40 caractères max)." }),
  difference: z
    .string()
    .trim()
    .max(200, { error: "Description trop longue (200 caractères max)." })
    .nullish(),
  washThreshold: z
    .number()
    .int({ error: "Le seuil doit être un nombre entier." })
    .min(1, { error: "Seuil minimum : 1 port." })
    .max(999, { error: "Seuil maximum : 999 ports." })
    .nullish(),
});

export type PieceFields = {
  type?: string[];
  title?: string[];
  color?: string[];
  difference?: string[];
  washThreshold?: string[];
};

/** État retourné par les routes pièces aux formulaires client. */
export type PieceFormState = {
  errors?: PieceFields;
  message?: string;
} | undefined;

/**
 * Normalise la sortie d'un formulaire HTML avant validation :
 * espaces retirés, chaînes vides → null pour les champs optionnels
 * (null efface la valeur en PATCH, undefined ne la toucherait pas).
 */
export function normalizePieceInput(raw: Record<string, unknown>): unknown {
  const str = (value: unknown) =>
    typeof value === "string" ? value.trim() : undefined;
  const optionalStr = (value: unknown) => {
    const v = str(value);
    return v ? v : null;
  };

  const threshold = str(raw.washThreshold);

  return {
    type: str(raw.type),
    title: str(raw.title),
    color: str(raw.color),
    difference: optionalStr(raw.difference),
    washThreshold: threshold ? Number(threshold) : null,
  };
}

/** Libellés français des types de pièces. */
export const PIECE_TYPE_LABELS = {
  TOP: "Haut",
  BOTTOM: "Pantalon",
} as const;
