import * as z from "zod";

// Réponse à la question « As-tu repassé la tenue ? » (§5) :
//   yes    → confirmée
//   no     → annulée, avec motif obligatoire
//   later  → reportée de 5 ou 30 minutes (le champ snoozedUntil est déjà
//            dans le modèle ; l'envoi de notification viendra à l'étape 4)

export const answerSchema = z
  .object({
    answer: z.enum(["yes", "no", "later"], { error: "Réponse invalide." }),
    reason: z
      .string()
      .trim()
      .max(200, { error: "Motif trop long (200 caractères max)." })
      .optional(),
    delay: z
      .number()
      .int({ error: "Durée de report invalide." })
      .refine((value) => value === 5 || value === 30, {
        error: "Le report doit être de 5 ou 30 minutes.",
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.answer === "no" && !value.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Le motif est requis en cas de refus.",
      });
    }
    if (value.answer === "later" && value.delay === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["delay"],
        message: "La durée du report est requise (5 ou 30 min).",
      });
    }
  });

export type AnswerBody = z.infer<typeof answerSchema>;
