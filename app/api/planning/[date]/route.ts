import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { isValidDateKey, dateFromKey } from "@/lib/planning/dates";
import { cancelWear } from "@/lib/planning/wears";

// PUT /api/planning/:date — définit (ou remplace) la tenue d'un jour.
// Corps : { associationId }        → la tenue est planifiée (statut PLANNED)
//         { associationId: null }  → le jour est vidé (tenue retirée)
// Une seule tenue par jour : contrainte @@unique([userId, date]).
// Retrait ou remplacement d'une tenue déjà confirmée annule le port qui
// avait été enregistré (le WearLog ne survit pas à sa tenue).

type Params = { params: Promise<{ date: string }> };

export async function PUT(request: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Authentification requise." },
      { status: 401 },
    );
  }

  const { date } = await params;
  if (!isValidDateKey(date)) {
    return NextResponse.json(
      { message: "Date invalide (YYYY-MM-DD attendu)." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const associationId = (body as { associationId?: unknown } | null)
    ?.associationId;

  const day = dateFromKey(date);

  // Retrait de la tenue du jour.
  if (associationId === null) {
    const existing = await prisma.plannedOutfit.findUnique({
      where: { userId_date: { userId, date: day } },
      select: { id: true },
    });
    if (existing) await cancelWear(existing.id);
    await prisma.plannedOutfit.deleteMany({
      where: { userId, date: day },
    });
    return NextResponse.json({ ok: true });
  }

  if (typeof associationId !== "string" || associationId.length === 0) {
    return NextResponse.json(
      { message: "associationId requis (ou null pour vider le jour)." },
      { status: 400 },
    );
  }

  // L'association doit appartenir à l'utilisateur.
  const association = await prisma.association.findFirst({
    where: { id: associationId, userId },
    select: { id: true },
  });
  if (!association) {
    return NextResponse.json(
      { message: "Association introuvable." },
      { status: 404 },
    );
  }

  // Remplacement : l'ancien port enregistré (s'il y en a un) est annulé,
  // l'ancienne tenue ne sera pas portée telle quelle.
  const previous = await prisma.plannedOutfit.findUnique({
    where: { userId_date: { userId, date: day } },
    select: { id: true },
  });
  if (previous) await cancelWear(previous.id);

  const planned = await prisma.plannedOutfit.upsert({
    where: { userId_date: { userId, date: day } },
    create: { userId, date: day, associationId },
    // Remplacer la tenue repasse en « prévue » : l'ancien statut
    // (confirmée/annulée) concernait l'ancienne tenue.
    update: { associationId, status: "PLANNED", cancelReason: null },
    include: { association: { include: { top: true, bottom: true } } },
  });

  return NextResponse.json({ planned });
}
