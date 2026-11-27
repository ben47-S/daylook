import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth/dal";
import {
  addDays,
  dateFromKey,
  dateKeyInZone,
  dayLabel,
  isValidDateKey,
  weekKeysFor,
  weekStartKey,
} from "@/lib/planning/dates";
import {
  countPlannedElsewhere,
  washWarnings,
  weeklyWarnings,
  type PlannedPiecesByDay,
} from "@/lib/planning/warnings";
import { WeekView, type DayPlan } from "@/components/planning/week-view";
import { HistorySheet } from "@/components/planning/history-sheet";

export const metadata: Metadata = {
  title: "Planning",
};

// Onglet 3 — une semaine calendaire lundi → dimanche par page, un jour par
// ligne, statut de chaque tenue et alertes colorées. Navigation ‹ › vers les
// autres semaines via `?week=YYYY-MM-DD` (clé ramenée au lundi). Une icône
// dans l'en-tête ouvre l'historique des ports en bottomsheet (§3).
// Session + BDD + searchParams chargés derrière un <Suspense> avec
// connection() (règle cacheComponents), comme sur l'accueil et la garde-robe.

type PlanningSearchParams = Promise<{ week?: string }>;

export default function PlanningPage({
  searchParams,
}: {
  searchParams: PlanningSearchParams;
}) {
  return (
    <main className="flex flex-1 flex-col p-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Planning</h1>
          <p className="truncate text-sm text-zinc-500">
            Semaine lundi → dimanche
          </p>
        </div>
        <HistorySheet />
      </header>

      <Suspense
        fallback={<p className="text-sm text-zinc-500">Chargement du planning…</p>}
      >
        <Semaine searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Semaine({
  searchParams,
}: {
  searchParams: PlanningSearchParams;
}) {
  await connection();

  const { week } = await searchParams;
  const user = await requireUser();
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { timezone: true },
  });
  const todayKey = dateKeyInZone(
    new Date(),
    account?.timezone ?? "Africa/Abidjan",
  );
  const weekKey = weekStartKey(
    week && isValidDateKey(week) ? week : todayKey,
  );
  const weekKeys = weekKeysFor(weekKey);

  // Veille et lendemain inclus dans la requête pour la pénalité d'adjacence
  // du moteur de propositions (appelé côté client par WeekView).
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

  const countedByDay: PlannedPiecesByDay = {};
  const byDayKey = new Map<string, (typeof outfits)[number]>();
  for (const outfit of outfits) {
    const key = outfit.date.toISOString().slice(0, 10);
    byDayKey.set(key, outfit);
    // Une tenue annulée reste affichée (avec son badge) mais ne compte pas
    // comme un port, ni dans la semaine, ni pour le seuil de lavage.
    if (outfit.status === "CANCELLED") continue;
    countedByDay[key] ??= [];
    countedByDay[key].push(
      outfit.association.topId,
      outfit.association.bottomId,
    );
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
      ...weeklyWarnings(top, dateKey, weekKeys, countedByDay),
      ...weeklyWarnings(bottom, dateKey, weekKeys, countedByDay),
      ...washWarnings(
        top,
        countPlannedElsewhere(countedByDay, weekKeys, top.id, dateKey),
      ),
      ...washWarnings(
        bottom,
        countPlannedElsewhere(countedByDay, weekKeys, bottom.id, dateKey),
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

  return <WeekView days={days} weekKey={weekKey} />;
}
