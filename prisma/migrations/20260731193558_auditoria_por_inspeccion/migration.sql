-- AlterTable
ALTER TABLE "public"."EventoAuditoria" ADD COLUMN     "inspeccionId" TEXT;

-- CreateIndex
CREATE INDEX "EventoAuditoria_inspeccionId_idx" ON "public"."EventoAuditoria"("inspeccionId");

-- CreateIndex
CREATE INDEX "EventoAuditoria_entidad_entidadId_idx" ON "public"."EventoAuditoria"("entidad", "entidadId");

-- AddForeignKey
ALTER TABLE "public"."EventoAuditoria" ADD CONSTRAINT "EventoAuditoria_inspeccionId_fkey" FOREIGN KEY ("inspeccionId") REFERENCES "public"."Inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
