import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { dateFromKey, isValidDateKey } from "@/lib/planning/dates";
import { answerSchema } from "@/lib/planning/schemas";
import { cancelWear, recordWear } from "@/lib/planning/wears";

// POST /api/planning/:date/answer — réponse à « repassée ? » (§5, §8) :
//   { answer: "yes" }                    → CONFIRMED + port enregistré
//   { answer: "no", reason }             → CANCELLED + motif (+ port annulé)
//   { answer: "later", delay: 5 | 30 }   → snoozedUntil = maintenant + delay
// Un « Oui » crée le WearLog du jour et incrémente les compteurs de ports
// des deux pièces (§10 : le port est enregistré à la confirmation) ; un
// « Non » annule le port s'il avait été enregistré. Idempotent — voir
// lib/planning/wears.ts.
// La question en attente et l'envoi des notifications sont l'étape 4.

type Params = { params: Promise<{ date: string }> };

export async function POST(request: Request, { params }: Params) {
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

  const validated = answerSchema.safeParse(body);
  if (!validated.success) {
    const first = Object.values(
      validated.error.flatten().fieldErrors,
    )[0]?.[0];
    return NextResponse.json(
      { message: first ?? "Réponse invalide." },
      { status: 400 },
    );
  }
  const { answer, reason, delay } = validated.data;

  const day = dateFromKey(date);
  const existing = await prisma.plannedOutfit.findUnique({
    where: { userId_date: { userId, date: day } },
    select: {
      id: true,
      association: { select: { topId: true, bottomId: true } },
    },
  });
  if (!existing) {
    return NextResponse.json(
      { message: "Aucune tenue prévue ce jour-là." },
      { status: 404 },
    );
  }

  const update =
    answer === "yes"
      ? { status: "CONFIRMED" as const, cancelReason: null, snoozedUntil: null }
      : answer === "no"
        ? {
            status: "CANCELLED" as const,
            cancelReason: reason ?? null,
            snoozedUntil: null,
          }
        : // « plus tard » : le statut et le motif restent en place, seule la
          // question est repoussée.
          { snoozedUntil: new Date(Date.now() + (delay ?? 5) * 60_000) };

  const planned = await prisma.plannedOutfit.update({
    where: { id: existing.id },
    data: update,
    select: { id: true, status: true, cancelReason: true, snoozedUntil: true },
  });

  // Port enregistré / annulé selon la réponse (§10).
  if (answer === "yes") {
    await recordWear(userId, day, existing);
  } else if (answer === "no") {
    await cancelWear(existing.id);
  }

  return NextResponse.json({ ok: true, planned });
}
