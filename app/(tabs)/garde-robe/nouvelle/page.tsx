import type { Metadata } from "next";
import { PieceForm } from "@/components/pieces/piece-form";

export const metadata: Metadata = {
  title: "Ajouter une pièce",
};

// Ajout d'une pièce : formulaire seul, sans lecture de session côté serveur
// (le proxy protège la route, l'API vérifie le cookie).

export default function NouvellePiecePage() {
  return (
    <main className="flex flex-1 flex-col p-4">
      <h1 className="mb-4 text-xl font-semibold">Ajouter une pièce</h1>
      <PieceForm />
    </main>
  );
}
