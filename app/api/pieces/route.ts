import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import {
  normalizePieceInput,
  pieceSchema,
  type PieceFormState,
} from "@/lib/pieces/schemas";

// GET  /api/pieces       — liste des pièces actives (non archivées)
// POST /api/pieces       — création d'une pièce

export async function GET(): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Authentification requise." },
      { status: 401 },
    );
  }

  const pieces = await prisma.piece.findMany({
    where: { userId, archived: false },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ pieces });
}

export async function POST(request: Request): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Authentification requise." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const state: PieceFormState = { message: "Requête invalide." };
    return NextResponse.json(state, { status: 400 });
  }

  const validated = pieceSchema.safeParse(
    normalizePieceInput((body ?? {}) as Record<string, unknown>),
  );
  if (!validated.success) {
    const state: PieceFormState = {
      errors: validated.error.flatten().fieldErrors,
    };
    return NextResponse.json(state, { status: 400 });
  }

  const piece = await prisma.piece.create({
    data: { userId, ...validated.data },
  });

  return NextResponse.json({ piece }, { status: 201 });
}
