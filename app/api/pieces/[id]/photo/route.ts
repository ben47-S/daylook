import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth/session";
import { cutoutImage } from "@/lib/photos/cutout";

// POST /api/pieces/:id/photo — upload (ou remplacement) de la photo d'une pièce.
// Fichier écrit dans storage/photos/<id>.<ext> ; photoPath en base stocke le
// chemin relatif. Un ancien fichier d'extension différent est supprimé.
// Étape 6 : le retrait du fond est généré à la volée (lib locale, cf.
// lib/photos/cutout.ts) → storage/photos/<id>.cutout.png dans cutoutPath.
// Best effort : si le détourage échoue, la photo reste utilisable telle
// quelle (le champ cutoutPath repasse à null).

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
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(join(process.cwd(), relativePath), bytes);

  // Ancien fichier supprimé si l'extension a changé (jpg → png par ex.)
  if (piece.photoPath && piece.photoPath !== relativePath) {
    await unlink(join(process.cwd(), piece.photoPath)).catch(() => {});
  }

  // Retrait du fond (étape 6) : PNG transparent à côté de la photo.
  // Le fichier cutout est toujours régénéré — un échec efface l'ancien
  // détourage pour ne jamais servir un découpage de l'ancienne photo.
  const cutoutRelative = join("storage", "photos", `${piece.id}.cutout.png`);
  const cutoutBytes = await cutoutImage(bytes, file.type);
  if (cutoutBytes) {
    await writeFile(join(process.cwd(), cutoutRelative), cutoutBytes);
  } else {
    await unlink(join(process.cwd(), cutoutRelative)).catch(() => {});
  }

  await prisma.piece.update({
    where: { id: piece.id },
    data: {
      photoPath: relativePath,
      cutoutPath: cutoutBytes ? cutoutRelative : null,
    },
  });

  return NextResponse.json({
    ok: true,
    photoPath: relativePath,
    cutoutPath: cutoutBytes ? cutoutRelative : null,
  });
}
