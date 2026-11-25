import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";

// POST /api/pieces/:id/wash — bouton « lavé » (§4, §8) : remet le compteur
// de ports à zéro et date le lavage. Archivées acceptées : laver une pièce
// archivée reste anodin.

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Authentification requise." },
      { status: 401 },
    );
  }

  const { id } = await params;
  const piece = await prisma.piece.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!piece) {
    return NextResponse.json(
      { message: "Pièce introuvable." },
      { status: 404 },
    );
  }

  const updated = await prisma.piece.update({
    where: { id: piece.id },
    data: { wearsSinceWash: 0, lastWashedAt: new Date() },
    select: { id: true, wearsSinceWash: true, lastWashedAt: true },
  });

  return NextResponse.json({ ok: true, piece: updated });
}
