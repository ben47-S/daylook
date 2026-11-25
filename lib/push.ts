import "server-only";
import webpush from "web-push";
import prisma from "@/lib/prisma";

// Envoi de notifications Web Push (§5). Clés VAPID dans .env
// (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT) —
// jamais commitées. Best effort : une erreur d'envoi ne fait jamais
// échouer la requête qui déclenche l'envoi.

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

let vapidReady = false;

function ensureVapid(): boolean {
  if (vapidReady) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false; // pas de clés → push inactif
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:contact@example.com",
    publicKey,
    privateKey,
  );
  vapidReady = true;
  return true;
}

/**
 * Envoie une notification à tous les abonnements push de l'utilisateur.
 * Les abonnements expirés (404/410 renvoyés par le navigateur) sont
 * supprimés au passage. Retourne le nombre de notifications livrées.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<number> {
  if (!ensureVapid()) return 0;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  let delivered = 0;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
      );
      delivered += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription
          .delete({ where: { id: subscription.id } })
          .catch(() => undefined);
      }
      // Autre erreur (réseau…) : on continue avec les autres abonnements.
    }
  }
  return delivered;
}
