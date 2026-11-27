import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { PieceForm } from "@/components/pieces/piece-form";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Ajouter une pièce",
};

// Ajout d'une pièce : formulaire seul. La session est vérifiée (et une
// session fantôme invalidée) derrière un <Suspense> + connection()
// (règle cacheComponents, même motif que garde-robe/planning) ;
// l'API revérifie le cookie de son côté.

export default function NouvellePiecePage() {
  return (
    <main className="flex flex-1 flex-col p-4">
      <h1 className="mb-4 text-xl font-semibold">Ajouter une pièce</h1>
      <Suspense
        fallback={<p className="text-sm text-zinc-500">Chargement…</p>}
      >
        <FormulairePiece />
      </Suspense>
    </main>
  );
}

async function FormulairePiece() {
  await connection();

  await requireUser();

  return <PieceForm />;
}
