// Helpers de dates du planning. Une date est un jour calendaire stocké en
// UTC minuit (@db.Date) et exprimé en clé "YYYY-MM-DD" ; l'affichage se fait
// dans le fuseau de l'utilisateur (timezone du User, Africa/Abidjan par
// défaut). Aucune dépendance serveur : utilisable côté client aussi.

export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Clé "YYYY-MM-DD" → Date UTC minuit. */
export function dateFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Date → clé "YYYY-MM-DD" dans le fuseau donné. */
export function dateKeyInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Heure locale (0..23) d'instant dans le fuseau donné. */
export function hourInZone(date: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date),
  );
}

/** Vrai si la clé est un jour calendaire réel (ex. "2026-02-31" → faux). */
export function isValidDateKey(key: string): boolean {
  if (!DATE_KEY_RE.test(key)) return false;
  const date = dateFromKey(key);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key
  );
}

/** Décale une clé de n jours (n peut être négatif). */
export function addDays(key: string, days: number): string {
  const date = dateFromKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** `count` jours consécutifs à partir de `startKey`. */
export function dayKeys(startKey: string, count = 7): string[] {
  return Array.from({ length: count }, (_, index) => addDays(startKey, index));
}

/** Lundi de la semaine (lundi → dimanche) contenant `key`. */
export function weekStartKey(key: string): string {
  const day = dateFromKey(key).getUTCDay(); // 0 = dimanche
  return addDays(key, day === 0 ? -6 : 1 - day);
}

/** Les 7 clés lundi → dimanche de la semaine contenant `key`. */
export function weekKeysFor(key: string): string[] {
  return dayKeys(weekStartKey(key), 7);
}

/**
 * Libellé d'affichage : « Aujourd'hui », « Demain », sinon « lun. 25 nov. ».
 * Le format court fr-FR est calé sur UTC car la clé est un jour calendaire.
 */
export function dayLabel(key: string, todayKey: string): string {
  if (key === todayKey) return "Aujourd'hui";
  if (key === addDays(todayKey, 1)) return "Demain";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(dateFromKey(key));
}
