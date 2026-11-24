import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Point d'entrée unique de l'accès aux données : toutes les requêtes
// de l'app passent par `import prisma from "@/lib/prisma"`.
// Le stockage sur `global` évite de recréer le client à chaque hot reload.

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Re-exporte le client généré : types, enums (PieceType, PlanStatus)
// et namespace Prisma disponibles depuis le même point d'entrée.
export * from "@/app/generated/prisma/client";
export { prisma };
export default prisma;
