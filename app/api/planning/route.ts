import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { isValidDateKey, dateFromKey } from "@/lib/planning/dates";

// GET /api/planning?from=&to= — tenues planifiées sur une plage de jours
// (avec l'association et ses deux pièces). Les clés sont "YYYY-MM-DD".

export async function GET(request: Request): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Authentification requise." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!isValidDateKey(from) || !isValidDateKey(to)) {
    return NextResponse.json(
      { message: "Paramètres from/to invalide (YYYY-MM-DD attendu)." },
      { status: 400 },
    );
  }
  if (from > to) {
    return NextResponse.json(
      { message: "from doit précéder to." },
      { status: 400 },
    );
  }

  const planned = await prisma.plannedOutfit.findMany({
    where: {
      userId,
      // Comparaison sur le jour calendaire (stockage UTC minuit).
      date: { gte: dateFromKey(from), lte: dateFromKey(to) },
    },
    include: { association: { include: { top: true, bottom: true } } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({ planned });
}
