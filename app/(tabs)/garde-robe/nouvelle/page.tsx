import type { Metadata } from "next";
import { PieceForm } from "@/components/pieces/piece-form";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "Ajouter une pièce",
};

// Ajout d'une pièce : formulaire seul. La session est vérifiée (et une
// session fantôme invalidée) comme sur les autres onglets ; l'API
// revérifie le cookie de son côté.

export default async function NouvellePiecePage() {
  await requireUser();

  return (
    <main className="flex flex-1 flex-col p-4">
      <h1 className="mb-4 text-xl font-semibold">Ajouter une pièce</h1>
      <PieceForm />
    </main>
  );
}
