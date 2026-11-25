import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import {
  normalizeEmail,
  registerSchema,
  type AuthFormState,
} from "@/lib/auth/schemas";

// POST /api/auth/register — inscription email + mot de passe.
// Crée l'utilisateur, signe le JWT et pose le cookie httpOnly.

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const state: AuthFormState = { message: "Requête invalide." };
    return NextResponse.json(state, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const validated = registerSchema.safeParse({
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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const state: AuthFormState = {
      message: "Un compte existe déjà avec cette adresse email.",
    };
    return NextResponse.json(state, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password) },
    select: { id: true },
  });

  await createSession(user.id);
  return NextResponse.json({ ok: true }, { status: 201 });
}
