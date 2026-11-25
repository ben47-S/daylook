import * as z from "zod";

// Schéma d'une association = couple (haut, pantalon).
// Vérifié dans la route : les deux pièces appartiennent à l'utilisateur,
// l'une est TOP et l'autre BOTTOM.

export const associationPairSchema = z.object({
  topId: z.string().min(1, { error: "Haut manquant." }),
  bottomId: z.string().min(1, { error: "Pantalon manquant." }),
});

export type AssociationBody = z.infer<typeof associationPairSchema>;
