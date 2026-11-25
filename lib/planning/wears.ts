import prisma from "@/lib/prisma";

// Enregistrement / annulation d'un port lié à une tenue planifiée (§5,
// §10). Invariant : un WearLog existe ⟺ la tenue du jour est confirmée.
//   - réponse « Oui » à « repassée ? »  → recordWear ;
//   - réponse « Non », retrait ou remplacement de la tenue → cancelWear.
// Toutes les écritures sont en transaction pour que le WearLog et les
// compteurs `wearsSinceWash` des deux pièces restent cohérents.

type PlanRef = {
  id: string;
  association: { topId: string; bottomId: string };
};

/**
 * Enregistre le port d'une tenue confirmée : WearLog du jour + compteur
 * des deux pièces. Idempotent — si le port existe déjà (double clic,
 * réponse répétée), on ne compte pas deux fois.
 */
export async function recordWear(userId: string, day: Date, plan: PlanRef) {
  const existing = await prisma.wearLog.findUnique({
    where: { plannedOutfitId: plan.id },
    select: { id: true },
  });
  if (existing) return;

  const { topId, bottomId } = plan.association;
  await prisma.$transaction([
    prisma.wearLog.create({
      data: { userId, date: day, topId, bottomId, plannedOutfitId: plan.id },
    }),
    prisma.piece.update({
      where: { id: topId },
      data: { wearsSinceWash: { increment: 1 } },
    }),
    prisma.piece.update({
      where: { id: bottomId },
      data: { wearsSinceWash: { increment: 1 } },
    }),
  ]);
}

/**
 * Annule le port enregistré pour une tenue (réponse « Non », retrait ou
 * remplacement de la tenue du jour) : le WearLog est supprimé et les
 * compteurs décrémentés, bornés à 0 (lavage intervenu entre-temps).
 */
export async function cancelWear(plannedOutfitId: string) {
  const log = await prisma.wearLog.findUnique({
    where: { plannedOutfitId },
    select: { id: true, topId: true, bottomId: true },
  });
  if (!log) return;

  const [top, bottom] = await Promise.all([
    prisma.piece.findUnique({
      where: { id: log.topId },
      select: { wearsSinceWash: true },
    }),
    prisma.piece.findUnique({
      where: { id: log.bottomId },
      select: { wearsSinceWash: true },
    }),
  ]);

  await prisma.$transaction([
    prisma.wearLog.delete({ where: { id: log.id } }),
    prisma.piece.update({
      where: { id: log.topId },
      data: { wearsSinceWash: Math.max(0, (top?.wearsSinceWash ?? 1) - 1) },
    }),
    prisma.piece.update({
      where: { id: log.bottomId },
      data: { wearsSinceWash: Math.max(0, (bottom?.wearsSinceWash ?? 1) - 1) },
    }),
  ]);
}
