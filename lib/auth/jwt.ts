import "server-only";
import { SignJWT, jwtVerify } from "jose";

// Signature / vérification des JWT de session (HS256).
// Ce module est la seule partie qui touche au secret : session.ts et
// proxy.ts l'importent pour ne jamais dupliquer la logique de token.

const secret = process.env.AUTH_SECRET;
if (!secret) {
  throw new Error("AUTH_SECRET manquant dans les variables d'environnement.");
}
const encodedKey = new TextEncoder().encode(secret);

export async function signSession(
  userId: string,
  expiresAt: Date,
): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(encodedKey);
}

/** Renvoie le userId si le token est valide, sinon null. */
export async function verifySession(
  token: string | undefined,
): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}
