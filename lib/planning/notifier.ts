import prisma from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { addDays, dateFromKey, dateKeyInZone, hourInZone } from "@/lib/planning/dates";

// Planificateur de notifications « la veille » à 20h, 21h, 22h et 23h
// (§5). Phase 1 : pas de cron tant que l'hébergement (§10) n'est pas
// tranché — l'envoi est opportuniste, déclenché à chaque appel de
// GET /api/pending-prompt (ouverture de l'app) et des routes du planning.
//
// Règles :
//   - uniquement la tenue de DEMAIN (fuseau utilisateur), statut PLANNED ;
//   - une heure locale (20..23) n'est envoyée qu'une fois (notifiedHours) ;
//   - une réponse (CONFIRMED/CANCELLED) arrête la série (statut filtré) ;
//   - un report « plus tard » (snoozedUntil) retarde : la notification
//     part quand snoozedUntil est passé, puis le champ est effacé pour
//     ne pas reboucler ; la série horaire reprend normalement.

const QUESTION_BODY = "As-tu repassé la tenue de demain et comptes-tu la porter ?";

export async function sendDueNotifications(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const zone = user?.timezone ?? "Africa/Abidjan";

  const now = new Date();
  const todayKey = dateKeyInZone(now, zone);
  const tomorrowKey = addDays(todayKey, 1);
  const hour = hourInZone(now, zone);

  const plans = await prisma.plannedOutfit.findMany({
    where: {
      userId,
      status: "PLANNED",
      date: dateFromKey(tomorrowKey),
    },
    select: { id: true, snoozedUntil: true, notifiedHours: true },
  });

  let sent = 0;
  for (const plan of plans) {
    const snoozeDue =
      plan.snoozedUntil !== null && plan.snoozedUntil.getTime() <= now.getTime();
    const snoozePending =
      plan.snoozedUntil !== null && plan.snoozedUntil.getTime() > now.getTime();
    const hourDue = hour >= 20 && hour <= 23 && !plan.notifiedHours.includes(hour);

    // Un report en cours suspend la série horaire.
    if (snoozePending || (!snoozeDue && !hourDue)) continue;

    const delivered = await sendPushToUser(userId, {
      title: "Tenues",
      body: QUESTION_BODY,
      url: "/",
      tag: `prompt-${tomorrowKey}`,
    });
    if (delivered === 0) continue; // pas d'abonnement : on réessaiera

    sent += delivered;
    await prisma.plannedOutfit.update({
      where: { id: plan.id },
      data: {
        ...(hourDue ? { notifiedHours: { push: hour } } : {}),
        ...(snoozeDue ? { snoozedUntil: null } : {}),
      },
    });
  }
  return sent;
}
