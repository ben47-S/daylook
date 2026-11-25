import * as z from "zod";

// Schémas de validation des formulaires d'authentification.
// Partagés entre les route handlers (validation serveur) et les formulaires
// client (types d'erreurs) — ce fichier ne contient aucun secret.

export const registerSchema = z.object({
  email: z
    .email({ error: "Veuillez saisir une adresse email valide." })
    .max(254, { error: "Adresse email trop longue." }),
  password: z
    .string()
    .min(8, { error: "Le mot de passe doit contenir au moins 8 caractères." }),
});

export const loginSchema = z.object({
  email: z.email({ error: "Veuillez saisir une adresse email valide." }),
  password: z.string().min(1, { error: "Le mot de passe est requis." }),
});

export type FieldErrors = {
  email?: string[];
  password?: string[];
};

/** État retourné par les handlers d'auth aux formulaires client. */
export type AuthFormState = {
  errors?: FieldErrors;
  message?: string;
} | undefined;

/** Normalise l'email avant validation (minuscules, espaces retirés). */
export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}
