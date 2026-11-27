import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "./session";

// Data Access Layer : l'endroit unique où l'app résout « qui est connecté ».
// Les pages passent par requireUser()/getCurrentUser() (lecture optimiste du
// x-user-id injecté par proxy.ts, avec repli sur le cookie) ; les route
// handlers et actions passent par getSessionUserId() dans lib/auth/session.ts.

export type SessionUser = { id: string };

/**
 * Renvoie l'utilisateur connecté ou null.
 * Directive `use cache: private` (cacheComponents) : la lecture d'en-tête
 * est réservée au navigateur et permet le prefetch par session.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  "use cache: private";

  const injectedUserId = (await headers()).get("x-user-id");
  if (injectedUserId) return { id: injectedUserId };

  // Repli : si proxy n'a pas tourné, on revérifie le cookie nous-mêmes.
  const userId = await getSessionUserId();
  return userId ? { id: userId } : null;
}

/**
 * Comme getCurrentUser(), mais redirige vers /connexion si absent — et
 * invalide la session si l'utilisateur n'existe plus en base (JWT encore
 * valide après suppression du compte : sans cette vérification, le proxy
 * renverrait en boucle entre / et /connexion).
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const exists = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true },
  });
  if (!exists) redirect("/api/auth/invalidate");

  return user;
}
