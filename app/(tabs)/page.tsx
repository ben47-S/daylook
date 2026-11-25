import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth/dal";
import { LogoutButton } from "@/components/auth/logout-button";
import { TenueAssemblee } from "@/components/outfits/tenue-assemblee";
import { StatusBadge } from "@/components/planning/status-badge";
import { AnswerCard } from "@/components/planning/answer-card";
import {
  addDays,
  dateFromKey,
  dateKeyInZone,
  dayLabel,
} from "@/lib/planning/dates";

// Accueil (onglet 1, §3) : tenue du jour (ou du lendemain) en vue
// assemblée, son statut, la carte « repassée ? » et les alertes de lavage.
// Session + BDD chargées derrière un <Suspense> avec connection() (règle
// cacheComponents) — le shell statique s'affiche, le contenu arrive en
// streaming.

type DayOutfit = {
  dateKey: string;
  label: string;
  status: "PLANNED" | "CONFIRMED" | "CANCELLED";
  cancelReason: string | null;
  top: {
    id: string;
    title: string;
    color: string;
    photoPath: string | null;
    wearsSinceWash: number;
    washThreshold: number | null;
  };
  bottom: {
    id: string;
    title: string;
    color: string;
    photoPath: string | null;
    wearsSinceWash: number;
    washThreshold: number | null;
  };
};

export default function Home() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <Suspense
        fallback={<p className="text-zinc-500">Chargement du compte…</p>}
      >
        <Accueil />
      </Suspense>
    </main>
  );
}

async function Accueil() {
  await connection();

  const user = await requireUser();

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, timezone: true },
  });
  if (!account) redirect("/connexion");

  const todayKey = dateKeyInZone(
    new Date(),
    account.timezone ?? "Africa/Abidjan",
  );
  const tomorrowKey = addDays(todayKey, 1);

  const [outfits, pieces] = await Promise.all([
    prisma.plannedOutfit.findMany({
      where: {
        userId: user.id,
        date: { in: [dateFromKey(todayKey), dateFromKey(tomorrowKey)] },
      },
      include: { association: { include: { top: true, bottom: true } } },
      orderBy: { date: "asc" },
    }),
    // Pièces avec seuil : base des alertes de lavage.
    prisma.piece.findMany({
      where: { userId: user.id, archived: false, washThreshold: { not: null } },
      select: {
        id: true,
        title: true,
        wearsSinceWash: true,
        washThreshold: true,
      },
    }),
  ]);

  const days: DayOutfit[] = outfits.map((outfit) => {
    const dateKey = outfit.date.toISOString().slice(0, 10);
    return {
      dateKey,
      label: dayLabel(dateKey, todayKey),
      status: outfit.status,
      cancelReason: outfit.cancelReason,
      top: {
        id: outfit.association.top.id,
        title: outfit.association.top.title,
        color: outfit.association.top.color,
        photoPath: outfit.association.top.photoPath,
        wearsSinceWash: outfit.association.top.wearsSinceWash,
        washThreshold: outfit.association.top.washThreshold,
      },
      bottom: {
        id: outfit.association.bottom.id,
        title: outfit.association.bottom.title,
        color: outfit.association.bottom.color,
        photoPath: outfit.association.bottom.photoPath,
        wearsSinceWash: outfit.association.bottom.wearsSinceWash,
        washThreshold: outfit.association.bottom.washThreshold,
      },
    };
  });

  const alerts = washAlerts(pieces);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Tenues</h1>
          <p className="truncate text-sm text-zinc-500">
            Bonjour {account.email}
          </p>
        </div>
        <LogoutButton />
      </header>

      {/* Tenues d'aujourd'hui et/ou de demain */}
      {days.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 p-8 text-center">
          <p className="text-sm font-medium text-zinc-600">
            Aucune tenue prévue
          </p>
          <p className="text-sm text-zinc-500">
            Choisis une tenue dans l&apos;onglet Planning.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {days.map((day) => (
            <section key={day.dateKey} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  {day.label}
                </h2>
                <StatusBadge status={day.status} />
              </div>

              {/* Carte pleine largeur : haut au-dessus de pantalon (le
                  composant gère ses lignes), motif d'annulation en
                  dessous. */}
              <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3">
                <TenueAssemblee top={day.top} bottom={day.bottom} />
                {day.status === "CANCELLED" && day.cancelReason && (
                  <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                    Annulée : {day.cancelReason}
                  </p>
                )}
              </div>

              {day.status === "PLANNED" && (
                <AnswerCard
                  dateKey={day.dateKey}
                  dayQuestion={
                    day.label === "Aujourd'hui"
                      ? "la tenue d'aujourd'hui"
                      : "la tenue de demain"
                  }
                />
              )}
            </section>
          ))}
        </div>
      )}

      {/* Alertes de lavage */}
      {alerts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Lavage
          </h2>
          <ul className="flex flex-col gap-1.5">
            {alerts.map((alert) => (
              <li
                key={alert.text}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  alert.level === "red"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {alert.text}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type WashPiece = {
  id: string;
  title: string;
  wearsSinceWash: number;
  washThreshold: number | null;
};

/**
 * Alertes de lavage de l'accueil (§3) : rouge = seuil atteint (la pièce
 * doit être lavée), orange = dernier port avant lavage.
 */
function washAlerts(pieces: WashPiece[]): Array<{
  level: "orange" | "red";
  text: string;
}> {
  const alerts: Array<{ level: "orange" | "red"; text: string }> = [];
  for (const piece of pieces) {
    if (piece.washThreshold === null) continue;
    if (piece.wearsSinceWash >= piece.washThreshold) {
      alerts.push({
        level: "red",
        text: `${piece.title} : laver (${piece.wearsSinceWash} ports sur ${piece.washThreshold})`,
      });
    } else if (piece.wearsSinceWash === piece.washThreshold - 1) {
      alerts.push({
        level: "orange",
        text: `${piece.title} : dernier port avant lavage`,
      });
    }
  }
  // Les plus urgents d'abord.
  alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === "red" ? -1 : 1));
  return alerts;
}
