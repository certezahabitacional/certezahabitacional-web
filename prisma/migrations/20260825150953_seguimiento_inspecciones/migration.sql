-- CreateEnum
CREATE TYPE "public"."EstadoSeguimientoHallazgo" AS ENUM ('CORREGIDO', 'PARCIALMENTE_CORREGIDO', 'NO_CORREGIDO', 'CORRECCION_NO_SATISFACTORIA', 'NUEVO_HALLAZGO');

-- AlterTable
ALTER TABLE "public"."Hallazgo" ADD COLUMN     "estadoSeguimiento" "public"."EstadoSeguimientoHallazgo",
ADD COLUMN     "hallazgoAnteriorId" TEXT,
ADD COLUMN     "observacionSeguimiento" TEXT;

-- AlterTable
ALTER TABLE "public"."Inspeccion" ADD COLUMN     "inspeccionAnteriorId" TEXT,
ADD COLUMN     "numeroInspeccion" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Hallazgo_hallazgoAnteriorId_idx" ON "public"."Hallazgo"("hallazgoAnteriorId");

-- CreateIndex
CREATE INDEX "Hallazgo_estadoSeguimiento_idx" ON "public"."Hallazgo"("estadoSeguimiento");

-- CreateIndex
CREATE INDEX "Inspeccion_numeroInspeccion_idx" ON "public"."Inspeccion"("numeroInspeccion");

-- CreateIndex
CREATE INDEX "Inspeccion_inspeccionAnteriorId_idx" ON "public"."Inspeccion"("inspeccionAnteriorId");

-- AddForeignKey
ALTER TABLE "public"."Inspeccion" ADD CONSTRAINT "Inspeccion_inspeccionAnteriorId_fkey" FOREIGN KEY ("inspeccionAnteriorId") REFERENCES "public"."Inspeccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Hallazgo" ADD CONSTRAINT "Hallazgo_hallazgoAnteriorId_fkey" FOREIGN KEY ("hallazgoAnteriorId") REFERENCES "public"."Hallazgo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
