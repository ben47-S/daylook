import "server-only";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { signSession, verifySession } from "./jwt";

// Gestion du cookie de session (httpOnly) via l'API cookies de Next.js.
// Un seul cookie, nommé `session`, contient un JWT signé de 7 jours.

export const SESSION_COOKIE = "session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await signSession(userId, expiresAt);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Vérification « sécurisée » : relit et vérifie le JWT directement depuis
 * le cookie. À utiliser dans les route handlers et server actions, proche
 * de la donnée, sans faire confiance à un en-tête injecté.
 *
 * Session fantôme (JWT valide mais compte supprimé de la base) : renvoie
 * null, comme si la session n'existait pas — l'API répond 401 au lieu de
 * planter sur une clé étrangère.
 */
export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const userId = await verifySession(token);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  return user ? userId : null;
}
