import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";

// POST /api/pieces/:id/photo — upload (ou remplacement) de la photo d'une pièce.
// Fichier écrit dans storage/photos/<id>.<ext> ; photoPath en base stocke le
// chemin relatif. Un ancien fichier d'extension différent est supprimé.

const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
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
    select: { id: true, photoPath: true },
  });
  if (!piece) {
    return NextResponse.json({ message: "Pièce introuvable." }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { message: "Corps de requête invalide (multipart requis)." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Aucun fichier reçu." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { message: "Format non supporté : une image est requise." },
      { status: 400 },
    );
  }
  const extension = EXTENSIONS[file.type];
  if (!extension) {
    return NextResponse.json(
      { message: "Formats acceptés : JPEG, PNG, WebP." },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { message: "Image trop lourde (10 Mo maximum)." },
      { status: 400 },
    );
  }

  const relativePath = join("storage", "photos", `${piece.id}.${extension}`);
  await mkdir(join(process.cwd(), "storage", "photos"), { recursive: true });
  await writeFile(
    join(process.cwd(), relativePath),
    Buffer.from(await file.arrayBuffer()),
  );

  // Ancien fichier supprimé si l'extension a changé (jpg → png par ex.)
  if (piece.photoPath && piece.photoPath !== relativePath) {
    await unlink(join(process.cwd(), piece.photoPath)).catch(() => {});
  }

  await prisma.piece.update({
    where: { id: piece.id },
    data: { photoPath: relativePath },
  });

  return NextResponse.json({ ok: true, photoPath: relativePath });
}
