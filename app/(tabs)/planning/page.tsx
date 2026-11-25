import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth/dal";
import {
  addDays,
  dateFromKey,
  dateKeyInZone,
  dayKeys,
  dayLabel,
} from "@/lib/planning/dates";
import {
  countPlannedElsewhere,
  repetitionWarnings,
  washWarnings,
  type PlannedPiecesByDay,
} from "@/lib/planning/warnings";
import { WeekView, type DayPlan } from "@/components/planning/week-view";
import { HistorySheet } from "@/components/planning/history-sheet";

export const metadata: Metadata = {
  title: "Planning",
};

// Onglet 3 — la semaine à venir, un jour par ligne, statut de chaque tenue
// et alertes colorées. Une icône dans l'en-tête ouvre l'historique des
// ports en bottomsheet (§3). Session + BDD chargées derrière un
// <Suspense> avec connection() (règle cacheComponents), comme sur
// l'accueil et la garde-robe.

export default function PlanningPage() {
  return (
    <main className="flex flex-1 flex-col p-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Planning</h1>
          <p className="truncate text-sm text-zinc-500">Semaine à venir</p>
        </div>
        <HistorySheet />
      </header>

      <Suspense
        fallback={<p className="text-sm text-zinc-500">Chargement du planning…</p>}
      >
        <Semaine />
      </Suspense>
    </main>
  );
}

async function Semaine() {
  await connection();

  const user = await requireUser();
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { timezone: true },
  });
  const todayKey = dateKeyInZone(
    new Date(),
    account?.timezone ?? "Africa/Abidjan",
  );
  const weekKeys = dayKeys(todayKey, 7);

  // Plutôt que la semaine seule : veille et lendemain compris, pour que
  // les alertes de répétition voient les jours adjacents.
  const outfits = await prisma.plannedOutfit.findMany({
    where: {
      userId: user.id,
      date: {
        gte: dateFromKey(addDays(weekKeys[0], -1)),
        lte: dateFromKey(addDays(weekKeys[6], 1)),
      },
    },
    include: { association: { include: { top: true, bottom: true } } },
  });

  const plannedByDay: PlannedPiecesByDay = {};
  const byDayKey = new Map<string, (typeof outfits)[number]>();
  for (const outfit of outfits) {
    const key = outfit.date.toISOString().slice(0, 10);
    plannedByDay[key] ??= [];
    plannedByDay[key].push(outfit.association.topId, outfit.association.bottomId);
    byDayKey.set(key, outfit);
  }

  const days: DayPlan[] = weekKeys.map((dateKey) => {
    const outfit = byDayKey.get(dateKey);
    if (!outfit) {
      return {
        dateKey,
        label: dayLabel(dateKey, todayKey),
        status: null,
        top: null,
        bottom: null,
        warnings: [],
      };
    }

    const { top, bottom } = outfit.association;
    const warnings = [
      ...repetitionWarnings(top, dateKey, plannedByDay),
      ...repetitionWarnings(bottom, dateKey, plannedByDay),
      ...washWarnings(
        top,
        countPlannedElsewhere(plannedByDay, weekKeys, top.id, dateKey),
      ),
      ...washWarnings(
        bottom,
        countPlannedElsewhere(plannedByDay, weekKeys, bottom.id, dateKey),
      ),
    ];

    return {
      dateKey,
      label: dayLabel(dateKey, todayKey),
      status: outfit.status,
      top: {
        id: top.id,
        title: top.title,
        color: top.color,
        photoPath: top.photoPath,
        wearsSinceWash: top.wearsSinceWash,
        washThreshold: top.washThreshold,
      },
      bottom: {
        id: bottom.id,
        title: bottom.title,
        color: bottom.color,
        photoPath: bottom.photoPath,
        wearsSinceWash: bottom.wearsSinceWash,
        washThreshold: bottom.washThreshold,
      },
      warnings,
    };
  });

  return <WeekView days={days} />;
}
