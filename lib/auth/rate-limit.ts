// Limitation de débit en mémoire sur les routes d'authentification
// (login/inscription) : protège contre le brute force. Fenêtre glissante
// simple, par adresse IP — suffisant pour une instance unique ; un
// redémarrage remet les compteurs à zéro (acceptable ici).

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5; // 5 échecs → blocage jusqu'à la fin de la fenêtre

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Adresse IP du client (derrière Cloudflare/Traefik). */
export function clientIp(request: Request): string {
  // Posé par Cloudflare : valeur de confiance (le X-Forwarded-For client
  // peut être falsifié pour contourner la limitation de débit).
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown"; // dev local sans proxy : compteur partagé
}

function bucket(key: string): Bucket | undefined {
  const found = buckets.get(key);
  if (!found) return undefined;
  if (Date.now() > found.resetAt) {
    buckets.delete(key); // fenêtre expirée
    return undefined;
  }
  return found;
}

/** true si la clé est bloquée (trop d'échecs récents). */
export function isBlocked(key: string): boolean {
  return (bucket(key)?.count ?? 0) >= MAX_ATTEMPTS;
}

/** Compte un échec (mauvais mot de passe, email déjà pris…). */
export function recordFailure(key: string): void {
  const now = Date.now();
  const found = bucket(key);
  if (found) {
    found.count += 1;
    return;
  }
  buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });

  // Élagage : au-delà de 1000 entrées, on purge les fenêtres expirées
  // pour ne pas grossir indéfiniment en mémoire.
  if (buckets.size > 1000) {
    for (const [k, v] of buckets) {
      if (now > v.resetAt) buckets.delete(k);
    }
  }
}

/** Remet le compteur à zéro après une réussite. */
export function clearFailures(key: string): void {
  buckets.delete(key);
}
