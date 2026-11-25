import "server-only";
import prisma from "@/lib/prisma";
import { sendDueNotifications } from "./notifier";

// Planificateur « file de tâches » (§5 : cron 20h–23h, gestion des
// reports). Phase 2 : l'app est hébergée sur un serveur physique avec
// Docker/Traefik — un processus long-lived peut donc faire office de
// cron. Toutes les minutes, on balaye les tenues de demain encore
// PLANNED et on envoie les notifications dues (fuseau de chaque
// utilisateur). Idempotent : notifiedHours évite les doublons, une
// réponse arrête la série.

const TICK_MS = 60_000;

// En dev, le rechargement à chaud relance register() : on ne garde
// qu'un seul intervalle par processus via globalThis.
const GLOBAL_KEY = "__daylookNotifier" as const;

type SchedulerState = { timer: ReturnType<typeof setInterval> };

export function startNotifier(): void {
  const globalState = globalThis as Record<string, unknown>;
  if (globalState[GLOBAL_KEY]) return;

  async function tick(): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        select: { id: true },
        take: 100, // usage personnel : large marge
      });
      for (const user of users) {
        await sendDueNotifications(user.id);
      }
    } catch (error) {
      // BDD indisponible au moment du tick : on ne tue pas le processus,
      // le tick suivant réessaiera.
      console.error("[notifier] tick en échec :", error);
    }
  }

  // Premier tick immédiat (rattrapage après redémarrage du conteneur),
  // puis toutes les minutes.
  void tick();
  const state: SchedulerState = {
    timer: setInterval(() => void tick(), TICK_MS),
  };
  // Ne bloque jamais l'arrêt propre du processus.
  state.timer.unref?.();
  globalState[GLOBAL_KEY] = state;
}
