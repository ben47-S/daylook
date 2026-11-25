import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";

// GET /api/history — historique des ports (§5, §8) : les 100 derniers
// WearLog de l'utilisateur, du plus récent au plus ancien, avec les
// titres des deux pièces. Alimente le bottomsheet d'historique.

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Authentification requise." },
      { status: 401 },
    );
  }

  const logs = await prisma.wearLog.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 100,
    select: {
      id: true,
      date: true,
      top: { select: { id: true, title: true } },
      bottom: { select: { id: true, title: true } },
    },
  });

  const history = logs.map((log) => ({
    id: log.id,
    dateKey: log.date.toISOString().slice(0, 10),
    top: log.top,
    bottom: log.bottom,
  }));

  return NextResponse.json({ history });
}
