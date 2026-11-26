import { Pool } from "pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Point d'entrée unique de l'accès aux données : toutes les requêtes
// de l'app passent par `import prisma from "@/lib/prisma"`.
// Le stockage sur `global` évite de recréer le client à chaque hot reload.
//
// Le pool pg est créé ici (et non laissé à l'adapter) pour survivre au
// pooler Neon, qui ferme les connexions inactives après ~5 min :
//   - idleTimeoutMillis < 5 min : le pool ferme ses connexions inactives
//     AVANT que le serveur ne les tue (sinon réutilisation d'une
//     connexion morte → « Connection terminated unexpectedly » après
//     ~80 s de rétransmission TCP) ;
//   - keepalives : détecte une connexion coupée en ~50 s au lieu de
//     laisser une requête bloquer ;
//   - connectionTimeoutMillis : échec rapide et lisible si le pool est
//     saturé, au lieu d'un hang.

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 30_000,
  });
  // Erreur sur un client inactif (connexion tombée entre deux requêtes) :
  // on logge, pg retire le client du pool tout seul.
  pool.on("error", (error) => {
    console.error("[prisma] client inactif en erreur :", error.message);
  });
  return pool;
}

const adapter = new PrismaPg(createPool());

const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Re-exporte le client généré : types, enums (PieceType, PlanStatus)
// et namespace Prisma disponibles depuis le même point d'entrée.
export * from "@/app/generated/prisma/client";
export { prisma };
export default prisma;
