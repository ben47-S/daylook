import { NextResponse } from "next/server";
import * as z from "zod";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";

// POST /api/push/subscribe (§8) — enregistre l'abonnement Web Push du
// navigateur. Corps : la sérialisation de PushSubscription (endpoint +
// keys.p256dh + keys.auth). Un endpoint est unique : on upsert pour que
// le rechargement de la page rafraîchisse l'abonnement sans doublon.

const subscribeSchema = z.object({
  endpoint: z.string().url({ error: "Endpoint invalide." }),
  keys: z.object({
    p256dh: z.string().min(1, { error: "Clé p256dh manquante." }),
    auth: z.string().min(1, { error: "Clé auth manquante." }),
  }),
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Authentification requise." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Abonnement push invalide." },
      { status: 400 },
    );
  }
  const { endpoint, keys } = parsed.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ ok: true });
}
