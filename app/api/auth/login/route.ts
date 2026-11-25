import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import {
  loginSchema,
  normalizeEmail,
  type AuthFormState,
} from "@/lib/auth/schemas";

// POST /api/auth/login — connexion email + mot de passe.
// Message d'erreur identique que l'email existe ou non (pas d'énumération).

export async function POST(request: Request): Promise<Response> {
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
  const valid =
    user !== null && (await verifyPassword(password, user.passwordHash));

  if (!valid) {
    const state: AuthFormState = {
      message: "Adresse email ou mot de passe incorrect.",
    };
    return NextResponse.json(state, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
