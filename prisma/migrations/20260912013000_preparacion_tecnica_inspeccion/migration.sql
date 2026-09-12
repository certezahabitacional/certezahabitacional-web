-- Preparacion tecnica previa a la inspeccion.
-- Documentos PDF por disciplina y guia ordenada de conceptos a revisar.

CREATE TABLE "DocumentoProyectoInspeccion" (
  "id" TEXT NOT NULL,
  "inspeccionId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "nombreOriginal" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "ruta" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
  "bytes" INTEGER NOT NULL,
  "subidoPorId" TEXT NOT NULL,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentoProyectoInspeccion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuiaInspeccionItem" (
  "id" TEXT NOT NULL,
  "inspeccionId" TEXT NOT NULL,
  "origen" TEXT NOT NULL,
  "tipoProyecto" TEXT,
  "area" TEXT NOT NULL,
  "concepto" TEXT NOT NULL,
  "especificacion" TEXT,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "obligatorio" BOOLEAN NOT NULL DEFAULT TRUE,
  "completado" BOOLEAN NOT NULL DEFAULT FALSE,
  "observacion" TEXT,
  "creadoPorId" TEXT,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuiaInspeccionItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DocumentoProyectoInspeccion"
  ADD CONSTRAINT "DocumentoProyectoInspeccion_inspeccionId_fkey"
  FOREIGN KEY ("inspeccionId") REFERENCES "Inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentoProyectoInspeccion"
  ADD CONSTRAINT "DocumentoProyectoInspeccion_subidoPorId_fkey"
  FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GuiaInspeccionItem"
  ADD CONSTRAINT "GuiaInspeccionItem_inspeccionId_fkey"
  FOREIGN KEY ("inspeccionId") REFERENCES "Inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuiaInspeccionItem"
  ADD CONSTRAINT "GuiaInspeccionItem_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentoProyectoInspeccion"
  ADD CONSTRAINT "DocumentoProyectoInspeccion_tipo_check"
  CHECK ("tipo" IN ('ARQUITECTONICO','FACHADAS','HIDRAULICA','SANITARIA','GAS','ELECTRICA','PUERTAS_VENTANAS','ACABADOS','AIRE_ACONDICIONADO','VOZ_DATOS','OTROS'));
ALTER TABLE "GuiaInspeccionItem"
  ADD CONSTRAINT "GuiaInspeccionItem_origen_check"
  CHECK ("origen" IN ('PROYECTO','COTIZACION','ESTANDAR','MANUAL'));

CREATE UNIQUE INDEX "DocumentoProyectoInspeccion_inspeccion_tipo_ruta_key" ON "DocumentoProyectoInspeccion"("inspeccionId","tipo","ruta");
CREATE INDEX "DocumentoProyectoInspeccion_inspeccionId_idx" ON "DocumentoProyectoInspeccion"("inspeccionId");
CREATE INDEX "DocumentoProyectoInspeccion_tipo_idx" ON "DocumentoProyectoInspeccion"("tipo");
CREATE INDEX "GuiaInspeccionItem_inspeccionId_orden_idx" ON "GuiaInspeccionItem"("inspeccionId","orden");
CREATE INDEX "GuiaInspeccionItem_origen_idx" ON "GuiaInspeccionItem"("origen");
