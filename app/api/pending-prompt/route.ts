import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { addDays, dateFromKey, dateKeyInZone } from "@/lib/planning/dates";
import { sendDueNotifications } from "@/lib/planning/notifier";

// GET /api/pending-prompt (§8) — appelée à l'ouverture de l'app.
// 1. Déclenche l'envoi des notifications dues (planificateur opportuniste
//    de l'étape 4 phase 1 — cf. lib/planning/notifier.ts).
// 2. Renvoie la question en attente s'il en reste une une non répondue :
//    la tenue de demain (ou d'aujourd'hui si on est passé à minuit) est
//    PLANNED et (a) une notification a déjà été envoyée cette nuit-là,
//    ou (b) il est au moins 20h locale. L'alerte s'affiche alors même
//    sans avoir cliqué sur la notification (§5).

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Authentification requise." },
      { status: 401 },
    );
  }

  await sendDueNotifications(userId).catch(() => 0);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const zone = user?.timezone ?? "Africa/Abidjan";
  const now = new Date();
  const todayKey = dateKeyInZone(now, zone);
  const tomorrowKey = addDays(todayKey, 1);

  const plans = await prisma.plannedOutfit.findMany({
    where: {
      userId,
      status: "PLANNED",
      date: { in: [dateFromKey(todayKey), dateFromKey(tomorrowKey)] },
    },
    select: {
      date: true,
      notifiedHours: true,
      snoozedUntil: true,
      association: { select: { top: { select: { title: true } } } },
    },
    orderBy: { date: "asc" },
  });

  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );

  for (const plan of plans) {
    const dateKey = plan.date.toISOString().slice(0, 10);
    const evening = dateKey === tomorrowKey && hour >= 20;
    const alreadyAsked = plan.notifiedHours.length > 0 || plan.snoozedUntil !== null;
    if (!evening && !alreadyAsked) continue;

    // Le report « plus tard » suspend l'alerte jusqu'à son échéance.
    if (plan.snoozedUntil && plan.snoozedUntil.getTime() > now.getTime()) {
      return NextResponse.json({ pending: false, snoozedUntil: plan.snoozedUntil });
    }

    return NextResponse.json({
      pending: true,
      dateKey,
      dayQuestion:
        dateKey === todayKey ? "la tenue d'aujourd'hui" : "la tenue de demain",
      topTitle: plan.association.top.title,
      snoozedUntil: plan.snoozedUntil,
    });
  }

  return NextResponse.json({ pending: false });
}
