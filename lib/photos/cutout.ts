import "server-only";
import { removeBackground } from "@imgly/background-removal-node";

// Retrait du fond des photos (§6) : lib locale @imgly/background-
// removal-node — modèle ONNX embarqué dans le paquet (aucun appel
// réseau, aucune clé API), exécuté côté serveur à l'upload.
// Best effort : renvoie null en cas d'échec pour que la photo d'origine
// reste affichable (le spec prévoit l'affichage « avec ou sans fond
// retiré »).
//
// La lib détermine le format via le type MIME du Blob : sans lui, elle
// lève « Unsupported format » — d'où le paramètre `mimeType`.

export async function cutoutImage(
  input: Buffer,
  mimeType: string,
): Promise<Buffer | null> {
  try {
    const blob = await removeBackground(
      new Blob([new Uint8Array(input)], { type: mimeType }),
    );
    return Buffer.from(await blob.arrayBuffer());
  } catch (error) {
    console.error("[cutout] échec du retrait du fond :", error);
    return null;
  }
}
