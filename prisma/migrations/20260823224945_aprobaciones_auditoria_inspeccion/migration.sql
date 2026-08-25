-- CreateEnum
CREATE TYPE "public"."TipoDecisionRevision" AS ENUM ('VISTO_BUENO', 'APROBADO', 'NO_APROBADO', 'RETENIDO_AUDITORIA', 'LEVANTAR_BLOQUEO');

-- CreateEnum
CREATE TYPE "public"."EstadoDecisionRevision" AS ENUM ('VIGENTE', 'INVALIDADA', 'SUPERADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."TipoEvento" ADD VALUE 'FINALIZAR_CAPTURA';
ALTER TYPE "public"."TipoEvento" ADD VALUE 'REVISION_INSPECCION';
ALTER TYPE "public"."TipoEvento" ADD VALUE 'BLOQUEAR_LIBERACION';
ALTER TYPE "public"."TipoEvento" ADD VALUE 'DESBLOQUEAR_LIBERACION';

-- AlterTable
ALTER TABLE "public"."Inspeccion" ADD COLUMN     "bloqueadaEn" TIMESTAMP(3),
ADD COLUMN     "bloqueadaPorId" TEXT,
ADD COLUMN     "liberacionBloqueada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "motivoBloqueoLiberacion" TEXT;

-- CreateTable
CREATE TABLE "public"."RevisionInspeccion" (
    "id" TEXT NOT NULL,
    "inspeccionId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rol" "public"."RolUsuario" NOT NULL,
    "decision" "public"."TipoDecisionRevision" NOT NULL,
    "estado" "public"."EstadoDecisionRevision" NOT NULL DEFAULT 'VIGENTE',
    "comentario" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionInspeccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RevisionInspeccion_inspeccionId_idx" ON "public"."RevisionInspeccion"("inspeccionId");

-- CreateIndex
CREATE INDEX "RevisionInspeccion_usuarioId_idx" ON "public"."RevisionInspeccion"("usuarioId");

-- CreateIndex
CREATE INDEX "RevisionInspeccion_rol_idx" ON "public"."RevisionInspeccion"("rol");

-- CreateIndex
CREATE INDEX "RevisionInspeccion_decision_idx" ON "public"."RevisionInspeccion"("decision");

-- CreateIndex
CREATE INDEX "RevisionInspeccion_estado_idx" ON "public"."RevisionInspeccion"("estado");

-- CreateIndex
CREATE INDEX "RevisionInspeccion_creadaEn_idx" ON "public"."RevisionInspeccion"("creadaEn");

-- CreateIndex
CREATE INDEX "Inspeccion_liberacionBloqueada_idx" ON "public"."Inspeccion"("liberacionBloqueada");

-- CreateIndex
CREATE INDEX "Inspeccion_bloqueadaPorId_idx" ON "public"."Inspeccion"("bloqueadaPorId");

-- AddForeignKey
ALTER TABLE "public"."Inspeccion" ADD CONSTRAINT "Inspeccion_bloqueadaPorId_fkey" FOREIGN KEY ("bloqueadaPorId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevisionInspeccion" ADD CONSTRAINT "RevisionInspeccion_inspeccionId_fkey" FOREIGN KEY ("inspeccionId") REFERENCES "public"."Inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RevisionInspeccion" ADD CONSTRAINT "RevisionInspeccion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
