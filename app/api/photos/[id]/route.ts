import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";

// GET /api/photos/:id — sert la photo d'une pièce (authentification exigée :
// les photos sont des données personnelles, le fichier n'est jamais exposé
// via public/). :id = identifiant de la pièce.

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Authentification requise." },
      { status: 401 },
    );
  }

  const { id } = await params;
  const piece = await prisma.piece.findFirst({
    where: { id, userId },
    select: { photoPath: true },
  });
  if (!piece?.photoPath) {
    return NextResponse.json({ message: "Photo introuvable." }, { status: 404 });
  }

  try {
    const data = await readFile(join(process.cwd(), piece.photoPath));
    const contentType =
      MIME_TYPES[extname(piece.photoPath).toLowerCase()] ?? "image/jpeg";

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        // Privé : jamais mis en cache partagé entre utilisateurs.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ message: "Photo introuvable." }, { status: 404 });
  }
}
