import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth/session";

// POST /api/auth/logout — supprime le cookie de session.
// Idempotent : fonctionne même si aucune session n'existe.

export async function POST(): Promise<Response> {
  await deleteSession();
  return NextResponse.json({ ok: true });
}
