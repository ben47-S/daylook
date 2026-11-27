import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth/session";

// GET /api/auth/invalidate — purge une session dont l'utilisateur n'existe
// plus en base (BD réinitialisée, compte supprimé) : le JWT est encore
// valide mais ne correspond à aucun compte.
// Appelé par requireUser() via redirect() — un Server Component ne peut
// pas supprimer un cookie lui-même, d'où ce passage par une route.
// N'efface que le cookie de la requête : sans effet sur autrui.

export async function GET(request: Request): Promise<Response> {
  await deleteSession();
  return NextResponse.redirect(new URL("/connexion", request.url));
}
