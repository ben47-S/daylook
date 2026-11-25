// Instrumentation Next.js : appelée une fois au démarrage de chaque
// instance serveur (cf. node_modules/next/dist/docs/01-app/02-guides/
// instrumentation.md). Ici : lance le planificateur de notifications
// (§5) — le « cron » 20h–23h de l'app, qui tourne dans le conteneur
// Docker au lieu d'un cron hôte (l'hébergement est un serveur physique
// + Traefik + tunnel Cloudflare, cf. §10).

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Jamais pendant `next build` : uniquement quand le serveur démarre.
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    // Import dynamique : instrumentation tourne aussi côté edge, et le
    // planificateur a besoin de Prisma/Node.
    const { startNotifier } = await import("./lib/planning/scheduler");
    startNotifier();
  }
}
