import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import {
  clearFailures,
  clientIp,
  isBlocked,
  recordFailure,
} from "@/lib/auth/rate-limit";
import {
  loginSchema,
  normalizeEmail,
  type AuthFormState,
} from "@/lib/auth/schemas";

// POST /api/auth/login — connexion email + mot de passe.
// Message d'erreur identique que l'email existe ou non (pas d'énumération).
// Limitation de débit par IP : 5 échecs / 15 min → 429 (brute force).
// Anti-énumération par timing : bcrypt tourne toujours, même si l'email
// est inconnu (comparaison sur ce hash factice) — la durée de réponse
// ne révèle pas l'existence du compte. Hash bcrypt coût 12 d'une chaîne
// jetable, généré une fois et inutilisé ailleurs.
const DUMMY_HASH =
  "$2b$12$95H0kxX7DwL5lSmnbx134OQJhcehhCTH/TRXqA8hU6PP3Fhn.RP7.";

export async function POST(request: Request): Promise<Response> {
  const rateKey = `login:${clientIp(request)}`;
  if (isBlocked(rateKey)) {
    return NextResponse.json(
      { message: "Trop de tentatives. Réessayez plus tard." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const state: AuthFormState = { message: "Requête invalide." };
    return NextResponse.json(state, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const validated = loginSchema.safeParse({
    email: normalizeEmail(raw.email),
    password: raw.password,
  });

  if (!validated.success) {
    const state: AuthFormState = {
      errors: validated.error.flatten().fieldErrors,
    };
    return NextResponse.json(state, { status: 400 });
  }

  const { email, password } = validated.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // bcrypt compare toujours tourné (hash factice si email inconnu) :
  // durée de réponse identique dans les deux cas.
  const valid =
    (await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)) &&
    user !== null;

  if (!valid) {
    recordFailure(rateKey);
    const state: AuthFormState = {
      message: "Adresse email ou mot de passe incorrect.",
    };
    return NextResponse.json(state, { status: 401 });
  }

  clearFailures(rateKey);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
