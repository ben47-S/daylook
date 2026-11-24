-- CreateEnum
CREATE TYPE "PieceType" AS ENUM ('TOP', 'BOTTOM');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Abidjan',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Piece" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PieceType" NOT NULL,
    "title" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "difference" TEXT,
    "photoPath" TEXT,
    "cutoutPath" TEXT,
    "washThreshold" INTEGER,
    "wearsSinceWash" INTEGER NOT NULL DEFAULT 0,
    "lastWashedAt" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Piece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Association" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topId" TEXT NOT NULL,
    "bottomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Association_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedOutfit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "associationId" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'PLANNED',
    "cancelReason" TEXT,
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedOutfit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WearLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "topId" TEXT NOT NULL,
    "bottomId" TEXT NOT NULL,
    "plannedOutfitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WearLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Piece_userId_type_idx" ON "Piece"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Association_topId_bottomId_key" ON "Association"("topId", "bottomId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedOutfit_userId_date_key" ON "PlannedOutfit"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WearLog_plannedOutfitId_key" ON "WearLog"("plannedOutfitId");

-- CreateIndex
CREATE INDEX "WearLog_userId_date_idx" ON "WearLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Association" ADD CONSTRAINT "Association_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Association" ADD CONSTRAINT "Association_topId_fkey" FOREIGN KEY ("topId") REFERENCES "Piece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Association" ADD CONSTRAINT "Association_bottomId_fkey" FOREIGN KEY ("bottomId") REFERENCES "Piece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedOutfit" ADD CONSTRAINT "PlannedOutfit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedOutfit" ADD CONSTRAINT "PlannedOutfit_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WearLog" ADD CONSTRAINT "WearLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WearLog" ADD CONSTRAINT "WearLog_topId_fkey" FOREIGN KEY ("topId") REFERENCES "Piece"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WearLog" ADD CONSTRAINT "WearLog_bottomId_fkey" FOREIGN KEY ("bottomId") REFERENCES "Piece"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WearLog" ADD CONSTRAINT "WearLog_plannedOutfitId_fkey" FOREIGN KEY ("plannedOutfitId") REFERENCES "PlannedOutfit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
