import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Stockage des photos (§6) — deux modes :
//   - R2 (Cloudflare) si R2_* est défini : les fichiers vivent dans le
//     bucket, la lecture passe par une URL signée (24 h) — le serveur
//     ne stocke ni ne sert les octets ;
//   - disque local (storage/) sinon : dev sans bucket, comportement
//     d'origine.
// photoPath / cutoutPath en base stockent toujours la même clé
// ("photos/<pièce>.<ext>") quel que soit le mode.

const config = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
};

export const r2Enabled = Boolean(
  config.accountId &&
    config.accessKeyId &&
    config.secretAccessKey &&
    config.bucket,
);

let client: S3Client | undefined;

function s3(): S3Client {
  client ??= new S3Client({
    region: "auto", // R2 impose "auto"
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId!,
      secretAccessKey: config.secretAccessKey!,
    },
  });
  return client;
}

function localPath(key: string): string {
  return join(process.cwd(), "storage", key);
}

export async function putPhoto(
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  if (r2Enabled) {
    await s3().send(
      new PutObjectCommand({
        Bucket: config.bucket!,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      }),
    );
    return;
  }
  await mkdir(dirname(localPath(key)), { recursive: true });
  await writeFile(localPath(key), bytes);
}

export async function deletePhoto(key: string): Promise<void> {
  try {
    if (r2Enabled) {
      await s3().send(
        new DeleteObjectCommand({ Bucket: config.bucket!, Key: key }),
      );
      return;
    }
    await unlink(localPath(key));
  } catch {
    // Best effort : un fichier déjà parti ne doit pas faire échouer
    // l'upload/remplacement.
  }
}

// Lecture : URL signée R2 (valable 24 h), ou null → la route sert le
// fichier depuis le disque local.
export async function photoUrl(key: string): Promise<string | null> {
  if (!r2Enabled) return null;
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: config.bucket!, Key: key }),
    { expiresIn: 86_400 },
  );
}

export async function readLocalPhoto(key: string): Promise<Buffer | null> {
  try {
    return await readFile(localPath(key));
  } catch {
    return null;
  }
}
