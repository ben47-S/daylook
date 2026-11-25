import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import {
  normalizePieceInput,
  pieceSchema,
  type PieceFormState,
} from "@/lib/pieces/schemas";

// GET    /api/pieces/:id  — détails d'une pièce
// PATCH  /api/pieces/:id  — modification des champs
// DELETE /api/pieces/:id  — archivage (jamais de suppression réelle :
//                            l'historique de ports ne doit pas casser)

type Params = { params: Promise<{ id: string }> };

async function findOwnedPiece(id: string, userId: string) {
  return prisma.piece.findFirst({ where: { id, userId } });
}

export async function GET(_request: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Authentification requise." },
      { status: 401 },
    );
  }

  const { id } = await params;
  const piece = await findOwnedPiece(id, userId);
  if (!piece) {
    return NextResponse.json({ message: "Pièce introuvable." }, { status: 404 });
  }

  return NextResponse.json({ piece });
}

export async function PATCH(request: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Authentification requise." },
      { status: 401 },
    );
  }

  const { id } = await params;
  const piece = await findOwnedPiece(id, userId);
  if (!piece) {
    return NextResponse.json({ message: "Pièce introuvable." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const state: PieceFormState = { message: "Requête invalide." };
    return NextResponse.json(state, { status: 400 });
  }

  const validated = pieceSchema.partial().safeParse(
    normalizePieceInput((body ?? {}) as Record<string, unknown>),
  );
  if (!validated.success) {
    const state: PieceFormState = {
      errors: validated.error.flatten().fieldErrors,
    };
    return NextResponse.json(state, { status: 400 });
  }

  const updated = await prisma.piece.update({
    where: { id: piece.id },
    data: validated.data,
  });

  return NextResponse.json({ piece: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Authentification requise." },
      { status: 401 },
    );
  }

  const { id } = await params;
  const piece = await findOwnedPiece(id, userId);
  if (!piece) {
    return NextResponse.json({ message: "Pièce introuvable." }, { status: 404 });
  }

  await prisma.piece.update({
    where: { id: piece.id },
    data: { archived: true },
  });

  return NextResponse.json({ ok: true });
}
