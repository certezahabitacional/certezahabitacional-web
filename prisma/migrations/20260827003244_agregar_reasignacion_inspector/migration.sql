-- CreateEnum
CREATE TYPE "public"."EstadoReasignacionInspector" AS ENUM ('PENDIENTE', 'AUTORIZADA', 'RECHAZADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "public"."ReasignacionInspector" (
    "id" TEXT NOT NULL,
    "inspeccionId" TEXT NOT NULL,
    "inspectorAnteriorId" TEXT,
    "inspectorPropuestoId" TEXT NOT NULL,
    "solicitadaPorId" TEXT NOT NULL,
    "resueltaPorId" TEXT,
    "estado" "public"."EstadoReasignacionInspector" NOT NULL DEFAULT 'PENDIENTE',
    "motivo" TEXT NOT NULL,
    "comentarioResolucion" TEXT,
    "solicitadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltaEn" TIMESTAMP(3),

    CONSTRAINT "ReasignacionInspector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReasignacionInspector_inspeccionId_idx" ON "public"."ReasignacionInspector"("inspeccionId");

-- CreateIndex
CREATE INDEX "ReasignacionInspector_inspectorAnteriorId_idx" ON "public"."ReasignacionInspector"("inspectorAnteriorId");

-- CreateIndex
CREATE INDEX "ReasignacionInspector_inspectorPropuestoId_idx" ON "public"."ReasignacionInspector"("inspectorPropuestoId");

-- CreateIndex
CREATE INDEX "ReasignacionInspector_solicitadaPorId_idx" ON "public"."ReasignacionInspector"("solicitadaPorId");

-- CreateIndex
CREATE INDEX "ReasignacionInspector_resueltaPorId_idx" ON "public"."ReasignacionInspector"("resueltaPorId");

-- CreateIndex
CREATE INDEX "ReasignacionInspector_estado_idx" ON "public"."ReasignacionInspector"("estado");

-- CreateIndex
CREATE INDEX "ReasignacionInspector_solicitadaEn_idx" ON "public"."ReasignacionInspector"("solicitadaEn");

-- AddForeignKey
ALTER TABLE "public"."ReasignacionInspector" ADD CONSTRAINT "ReasignacionInspector_inspeccionId_fkey" FOREIGN KEY ("inspeccionId") REFERENCES "public"."Inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReasignacionInspector" ADD CONSTRAINT "ReasignacionInspector_inspectorAnteriorId_fkey" FOREIGN KEY ("inspectorAnteriorId") REFERENCES "public"."Inspector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReasignacionInspector" ADD CONSTRAINT "ReasignacionInspector_inspectorPropuestoId_fkey" FOREIGN KEY ("inspectorPropuestoId") REFERENCES "public"."Inspector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReasignacionInspector" ADD CONSTRAINT "ReasignacionInspector_solicitadaPorId_fkey" FOREIGN KEY ("solicitadaPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReasignacionInspector" ADD CONSTRAINT "ReasignacionInspector_resueltaPorId_fkey" FOREIGN KEY ("resueltaPorId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
