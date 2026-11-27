import { Suspense } from "react";
import { connection } from "next/server";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth/dal";
import { dateKeyInZone, weekKeysFor } from "@/lib/planning/dates";
import { weeklyWearCounts } from "@/lib/planning/wears";
import { AssociationsSheet } from "@/components/associations/associations-sheet";

export const metadata: Metadata = {
  title: "Garde-robe",
};

// Onglet 2 — grille des hauts et des pantalons (photo, titre, couleur,
// compteur depuis le lavage + ports cette semaine) + bouton « + ». Le
// contenu connecté stream derrière un <Suspense> (règle cacheComponents),
// comme sur l'accueil.

export default function GardeRobePage() {
  return (
    <main className="flex flex-1 flex-col p-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Garde-robe</h1>
        <Link
          href="/garde-robe/nouvelle"
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700"
        >
          + Ajouter
        </Link>
      </header>

      <Suspense
        fallback={<p className="text-sm text-zinc-500">Chargement des pièces…</p>}
      >
        <GrillePieces />
      </Suspense>
    </main>
  );
}

async function GrillePieces() {
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

  const [pieces, weeklyCounts] = await Promise.all([
    prisma.piece.findMany({
      where: { userId: user.id, archived: false },
      orderBy: { createdAt: "desc" },
    }),
    weeklyWearCounts(user.id, weekKeysFor(todayKey)),
  ]);

  if (pieces.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 p-8 text-center">
        <p className="text-sm font-medium text-zinc-600">
          Aucune pièce pour l&apos;instant
        </p>
        <p className="text-sm text-zinc-500">
          Ajoute ton premier haut ou pantalon avec le bouton « + ».
        </p>
      </div>
    );
  }

  const tops = pieces.filter((piece) => piece.type === "TOP");
  const bottoms = pieces.filter((piece) => piece.type === "BOTTOM");

  // Les hauts en haut, les pantalons en bas, séparés par un trait.
  return (
    <div className="flex flex-col gap-6">
      {tops.length > 0 && (
        <Section titre="Hauts" pieces={tops} weeklyCounts={weeklyCounts} />
      )}
      {tops.length > 0 && bottoms.length > 0 && (
        <hr className="border-zinc-200" />
      )}
      {bottoms.length > 0 && (
        <Section
          titre="Pantalons"
          pieces={bottoms}
          weeklyCounts={weeklyCounts}
        />
      )}
    </div>
  );
}

function Section({
  titre,
  pieces,
  weeklyCounts,
}: {
  titre: string;
  pieces: Array<{
    id: string;
    type: "TOP" | "BOTTOM";
    title: string;
    color: string;
    photoPath: string | null;
    wearsSinceWash: number;
    washThreshold: number | null;
  }>;
  weeklyCounts: Map<string, number>;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {titre}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pieces.map((piece) => (
          <li key={piece.id} className="relative">
            <Link
              href={`/garde-robe/${piece.id}`}
              className="block overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:border-zinc-400"
            >
              <div className="aspect-square bg-zinc-100">
                {piece.photoPath ? (
                  <Image
                    src={`/api/photos/${piece.id}`}
                    alt={piece.title}
                    unoptimized
                    width={400}
                    height={400}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      className="h-10 w-10 text-zinc-300"
                      aria-hidden="true"
                    >
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 15 4.5-4.5 3 3L15 9l6 6" />
                      <circle cx="8.5" cy="9.5" r="1.25" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-0.5 p-2.5">
                <p className="truncate text-sm font-medium">{piece.title}</p>
                <p className="truncate text-xs text-zinc-500">{piece.color}</p>
                <Compteurs
                  wears={piece.wearsSinceWash}
                  threshold={piece.washThreshold}
                  weekly={weeklyCounts.get(piece.id) ?? 0}
                />
              </div>
            </Link>
            {/* Bouton associations : hors du <Link> pour que le clic
                ouvre le bottomsheet au lieu de naviguer. */}
            <div className="absolute right-2 top-2">
              <AssociationsSheet piece={piece} variant="icon" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Compteurs({
  wears,
  threshold,
  weekly,
}: {
  wears: number;
  threshold: number | null;
  weekly: number;
}) {
  const label = `${wears} port${wears > 1 ? "s" : ""}`;
  const weeklyLabel = `${weekly} port${weekly > 1 ? "s" : ""} cette semaine`;
  const overThreshold = threshold !== null && wears >= threshold;

  return (
    <div className="flex flex-col">
      <p
        className={`text-xs ${overThreshold ? "font-medium text-red-600" : "text-zinc-400"}`}
      >
        {threshold !== null ? `${label} / ${threshold}` : label}
      </p>
      <p className="text-xs text-zinc-400">{weeklyLabel}</p>
    </div>
  );
}
