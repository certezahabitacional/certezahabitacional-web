-- CreateEnum
CREATE TYPE "public"."TipoEvento" AS ENUM ('LOGIN', 'LOGOUT', 'CREAR', 'EDITAR', 'ELIMINAR', 'EMITIR_CERTIFICADO', 'REVOCAR_CERTIFICADO', 'REACTIVAR_CERTIFICADO', 'SUBIR_EVIDENCIA', 'ELIMINAR_EVIDENCIA', 'FIRMAR', 'DESCARGAR_REPORTE');

-- CreateTable
CREATE TABLE "public"."EventoAuditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "tipo" "public"."TipoEvento" NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "descripcion" TEXT NOT NULL,
    "ip" TEXT,
    "navegador" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventoAuditoria_usuarioId_idx" ON "public"."EventoAuditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "EventoAuditoria_tipo_idx" ON "public"."EventoAuditoria"("tipo");

-- CreateIndex
CREATE INDEX "EventoAuditoria_creadoEn_idx" ON "public"."EventoAuditoria"("creadoEn");

-- AddForeignKey
ALTER TABLE "public"."EventoAuditoria" ADD CONSTRAINT "EventoAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
