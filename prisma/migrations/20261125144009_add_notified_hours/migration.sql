-- AlterTable
ALTER TABLE "PlannedOutfit" ADD COLUMN     "notifiedHours" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
