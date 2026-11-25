import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import {
  addDays,
  dateFromKey,
  dateKeyInZone,
  dayKeys,
  isValidDateKey,
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const todayKey = dateKeyInZone(
    new Date(),
    user?.timezone ?? "Africa/Abidjan",
  );
  // Semaine affichée = 7 jours à partir d'aujourd'hui (même fenêtre que
  // l'onglet Planning) : sert au compte des ports déjà prévus dans la semaine.
  const weekKeys = dayKeys(todayKey, 7);

  // Fenêtre d'adjacence : la semaine + veille/lendemain du jour proposé
  // (bornes élargies si le jour tombe hors semaine).
  const rangeStart = date < weekKeys[0] ? date : weekKeys[0];
  const rangeEnd =
    date > weekKeys[weekKeys.length - 1] ? date : weekKeys[weekKeys.length - 1];
  const startAdjacent = addDays(rangeStart, -1);
  const endAdjacent = addDays(rangeEnd, 1);

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
