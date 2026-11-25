import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth/dal";
import { PieceForm } from "@/components/pieces/piece-form";
import { WashButton } from "@/components/pieces/wash-button";
import { CompatibleList } from "@/components/associations/compatible-list";
import { TenueAssemblee } from "@/components/outfits/tenue-assemblee";

export const metadata: Metadata = {
  title: "Modifier la pièce",
};

// Fiche d'une pièce : état (compteur de ports, seuil, bouton « lavé »),
// formulaire, pièces compatibles (cases à cocher qui gèrent les
// associations) et combinaisons en vue assemblée.
// Session + BDD chargées derrière un <Suspense> avec connection() —
// même motif que l'accueil et la garde-robe.

export default function EditionPiecePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="flex flex-1 flex-col p-4">
      <Suspense
        fallback={<p className="text-sm text-zinc-500">Chargement…</p>}
      >
        <EditionPiece params={params} />
      </Suspense>
    </main>
  );
}

async function EditionPiece({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;
  const user = await requireUser();

  const piece = await prisma.piece.findFirst({
    where: { id, userId: user.id, archived: false },
  });
  if (!piece) notFound();

  const oppositeType = piece.type === "TOP" ? "BOTTOM" : "TOP";
  const [compatibles, associations] = await Promise.all([
    // Pièces de l'autre type pour les cases à cocher
    prisma.piece.findMany({
      where: { userId: user.id, archived: false, type: oppositeType },
      orderBy: { createdAt: "desc" },
    }),
    // Associations de cette pièce, avec les deux pièces pour la vue assemblée
    prisma.association.findMany({
      where: {
        userId: user.id,
        OR: [{ topId: piece.id }, { bottomId: piece.id }],
      },
      include: { top: true, bottom: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const linkedIds = associations.map((association) =>
    association.topId === piece.id ? association.bottomId : association.topId,
  );

  // Dernier port réel (pour afficher « dernier port » sous le compteur).
  const lastWorn = await prisma.wearLog.findFirst({
    where: { userId: user.id, OR: [{ topId: piece.id }, { bottomId: piece.id }] },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Modifier la pièce</h1>

        {/* État : compteur de ports depuis le lavage, seuil, bouton « lavé » */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-zinc-500">Ports depuis le lavage</p>
            <p className="text-2xl font-semibold">
              {piece.wearsSinceWash}
              {piece.washThreshold !== null && (
                <span className="text-base font-normal text-zinc-400">
                  {" "}
                  / {piece.washThreshold}
                </span>
              )}
            </p>
            <p className="text-xs text-zinc-500">
              {piece.lastWashedAt
                ? `Dernier lavage : ${formatDay(piece.lastWashedAt)}`
                : "Jamais lavée"}
              {lastWorn
                ? ` · Dernier port : ${formatDay(lastWorn.date)}`
                : " · Jamais portée"}
            </p>
          </div>
          <WashButton pieceId={piece.id} />
        </div>

        <PieceForm piece={piece} />
      </section>

      <section className="flex flex-col gap-3 border-t border-zinc-200 pt-6">
        <div>
          <h2 className="text-base font-semibold">Pièces compatibles</h2>
          <p className="text-sm text-zinc-500">
            Coche une pièce pour créer la combinaison, décoche pour la retirer.
          </p>
        </div>
        <CompatibleList
          piece={piece}
          options={compatibles}
          linkedIds={linkedIds}
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-zinc-200 pt-6">
        <h2 className="text-base font-semibold">
          Combinaisons{" "}
          <span className="font-normal text-zinc-500">
            ({associations.length})
          </span>
        </h2>
        {associations.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {associations.map((association) => (
              <li
                key={association.id}
                className="rounded-xl border border-zinc-200 bg-white p-2.5"
              >
                <TenueAssemblee
                  top={association.top}
                  bottom={association.bottom}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">
            Aucune combinaison pour l&apos;instant — coche une pièce
            ci-dessus.
          </p>
        )}
      </section>
    </div>
  );
}

/** Date courte fr-FR calée sur UTC (jour calendaire stocké en UTC minuit). */
function formatDay(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
