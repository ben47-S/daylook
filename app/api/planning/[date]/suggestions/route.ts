import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import {
  addDays,
  dateFromKey,
  isValidDateKey,
  weekKeysFor,
} from "@/lib/planning/dates";
import { buildSuggestions } from "@/lib/planning/suggestions";
import { type PlannedPiecesByDay } from "@/lib/planning/warnings";

// GET /api/planning/:date/suggestions — tenues proposées pour un jour
// (§4 : uniquement les associations existantes, filtre de seuil de lavage,
// classement anti-répétition, alertes colorées orange/rouge).

type Params = { params: Promise<{ date: string }> };

export async function GET(_request: Request, { params }: Params) {
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

  // Semaine calendaire lundi → dimanche contenant le jour proposé : c'est
  // elle qui sert au compte des ports prévus, y compris quand on navigue
  // vers une autre semaine depuis l'onglet Planning.
  const weekKeys = weekKeysFor(date);

  // Fenêtre d'adjacence : la semaine + veille/lendemain du jour proposé,
  // pour l'alerte « deux jours de suite » du classement.
  const startAdjacent = addDays(weekKeys[0], -1);
  const endAdjacent = addDays(weekKeys[6], 1);

  const [associations, outfits, wearLogs] = await Promise.all([
    prisma.association.findMany({
      where: {
        userId,
        top: { archived: false },
        bottom: { archived: false },
      },
      include: { top: true, bottom: true },
    }),
    prisma.plannedOutfit.findMany({
      where: {
        userId,
        status: { not: "CANCELLED" }, // une tenue annulée ne compte pas comme portée
        date: { gte: dateFromKey(startAdjacent), lte: dateFromKey(endAdjacent) },
      },
      include: { association: { select: { topId: true, bottomId: true } } },
    }),
    // Dernier port réel par pièce (classement « depuis le plus longtemps »).
    prisma.wearLog.findMany({
      where: { userId, date: { lte: dateFromKey(date) } },
      select: { topId: true, bottomId: true, date: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const planned: PlannedPiecesByDay = {};
  for (const outfit of outfits) {
    const key = outfit.date.toISOString().slice(0, 10);
    planned[key] ??= [];
    planned[key].push(outfit.association.topId, outfit.association.bottomId);
  }

  const lastWorn = new Map<string, Date>();
  for (const log of wearLogs) {
    if (!lastWorn.has(log.topId)) lastWorn.set(log.topId, log.date);
    if (!lastWorn.has(log.bottomId)) lastWorn.set(log.bottomId, log.date);
  }

  const suggestions = buildSuggestions({
    associations: associations.map((association) => ({
      id: association.id,
      top: {
        id: association.top.id,
        title: association.top.title,
        color: association.top.color,
        photoPath: association.top.photoPath,
        wearsSinceWash: association.top.wearsSinceWash,
        washThreshold: association.top.washThreshold,
        lastWornAt: lastWorn.get(association.top.id) ?? null,
      },
      bottom: {
        id: association.bottom.id,
        title: association.bottom.title,
        color: association.bottom.color,
        photoPath: association.bottom.photoPath,
        wearsSinceWash: association.bottom.wearsSinceWash,
        washThreshold: association.bottom.washThreshold,
        lastWornAt: lastWorn.get(association.bottom.id) ?? null,
      },
    })),
    dateKey: date,
    weekKeys,
    planned,
  });

  return NextResponse.json({ suggestions });
}
