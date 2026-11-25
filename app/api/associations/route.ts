import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { associationPairSchema } from "@/lib/associations/schemas";

// GET    /api/associations — toutes les associations de l'utilisateur
//                            (avec les deux pièces incluses)
// POST   /api/associations — crée le couple { topId, bottomId } (idempotent :
//                            une même paire n'existe qu'une fois, §4)
// DELETE /api/associations — retire le couple { topId, bottomId } (idempotent)

async function requireUserId(): Promise<
  { userId: string } | { response: Response }
> {
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      response: NextResponse.json(
        { message: "Authentification requise." },
        { status: 401 },
      ),
    };
  }
  return { userId };
}

export async function GET(): Promise<Response> {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const associations = await prisma.association.findMany({
    where: { userId: auth.userId },
    include: { top: true, bottom: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ associations });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const validated = associationPairSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { message: validated.error.flatten().fieldErrors.topId?.[0] ?? "Requête invalide." },
      { status: 400 },
    );
  }
  const { topId, bottomId } = validated.data;

  // Les deux pièces doivent appartenir à l'utilisateur.
  const pieces = await prisma.piece.findMany({
    where: { id: { in: [topId, bottomId] }, userId: auth.userId },
    select: { id: true, type: true, archived: true },
  });
  if (pieces.length !== 2) {
    return NextResponse.json(
      { message: "Pièce introuvable." },
      { status: 404 },
    );
  }

  const top = pieces.find((piece) => piece.id === topId);
  const bottom = pieces.find((piece) => piece.id === bottomId);
  if (top?.type !== "TOP" || bottom?.type !== "BOTTOM") {
    return NextResponse.json(
      { message: "Une association relie un haut et un pantalon." },
      { status: 400 },
    );
  }

  // Idempotent : la paire existe déjà → on renvoie l'existante.
  const existing = await prisma.association.findUnique({
    where: { topId_bottomId: { topId, bottomId } },
  });
  if (existing) {
    return NextResponse.json({ ok: true, association: existing });
  }

  try {
    const association = await prisma.association.create({
      data: { userId: auth.userId, topId, bottomId },
    });
    return NextResponse.json({ ok: true, association }, { status: 201 });
  } catch {
    // Course possible (double clic) : la contrainte unique a gagné.
    const raced = await prisma.association.findUnique({
      where: { topId_bottomId: { topId, bottomId } },
    });
    if (raced) return NextResponse.json({ ok: true, association: raced });
    return NextResponse.json(
      { message: "Erreur lors de la création." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const validated = associationPairSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  // Suppression limitée à l'utilisateur (idempotente).
  await prisma.association.deleteMany({
    where: {
      userId: auth.userId,
      topId: validated.data.topId,
      bottomId: validated.data.bottomId,
    },
  });

  return NextResponse.json({ ok: true });
}
