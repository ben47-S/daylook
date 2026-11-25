import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/jwt";

// Proxy (ex-middleware en Next 16) : tourne avant chaque requête.
// - pages publiques / connexion, /inscription
// - redirige les visiteurs non connectés vers /connexion
// - renvoie 401 sur les API protégées sans session
// - injecte l'en-tête x-user-id (en écrasant toute valeur client) pour
//   que l'app résolve l'utilisateur sans re-vérifier le cookie partout.
// Vérification optimiste uniquement (pas de BDD ici) : les route handlers
// et actions restent chargés de la vraie vérification proche de la donnée.

const PUBLIC_PAGES = ["/connexion", "/inscription"];
const PUBLIC_APIS = ["/api/auth/register", "/api/auth/login", "/api/auth/logout"];

export default async function proxy(request: NextRequest): Promise<Response> {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get("session")?.value;
  const userId = await verifySession(token);

  const isPublicPage = PUBLIC_PAGES.includes(pathname);
  const isPublicApi = PUBLIC_APIS.includes(pathname);
  const isApi = pathname.startsWith("/api");

  // --- Non connecté ---
  if (!userId) {
    if (isApi && !isPublicApi) {
      return NextResponse.json(
        { message: "Authentification requise." },
        { status: 401 },
      );
    }
    if (!isApi && !isPublicPage) {
      return NextResponse.redirect(new URL("/connexion", request.nextUrl));
    }
    return NextResponse.next();
  }

  // --- Connecté : on injecte le userId en en-tête ---
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-user-id"); // jamais de valeur client de conservée
  requestHeaders.set("x-user-id", userId);

  // Un connecté qui visite /connexion ou /inscription revient à l'accueil.
  if (isPublicPage) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Tout sauf les fichiers statiques et optimisations d'images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|gif|svg|ico|woff2?)$).*)",
  ],
};
