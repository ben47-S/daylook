// Compression des photos à l'envoi (§2 : « Redimensionnement et
// compression des images à l'envoi »). Côté client, dans le navigateur :
// la photo est réduite à MAX_DIMENSION px de côté au maximum et ré-encodée
// en JPEG de qualité QUALITY. Si le résultat est plus lourd que l'original,
// on renvoie l'original (utile pour les petits PNG).

const MAX_DIMENSION = 1024;
const QUALITY = 0.82;
// En dessous de ce poids et de cette dimension, inutile de traiter.
const ALREADY_SMALL = 200 * 1024;

/**
 * Compresse une image d'upload. Retourne un File (JPEG .jpg si la
 * compression a eu lieu, sinon l'original). Ne lève jamais : en cas d'échec
 * (format non décodable), l'original est envoyé tel quel.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    // imageOrientation: "from-image" applique l'EXIF de rotation du
    // téléphone (fallback : ancien comportement sans orientation).
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      bitmap = await createImageBitmap(file);
    }

    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_DIMENSION / longest);

    if (scale === 1 && file.size <= ALREADY_SMALL) {
      bitmap.close();
      return file;
    }

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
