-- Cotización pública versionada
ALTER TABLE "Cotizacion"
ADD COLUMN "origenPublico" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "editablePublica" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "versionActual" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "zonaId" TEXT;

CREATE TABLE "CotizacionVersion" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "datos" JSONB NOT NULL,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CotizacionVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CotizacionVersion_cotizacionId_version_key"
ON "CotizacionVersion"("cotizacionId", "version");

CREATE INDEX "CotizacionVersion_cotizacionId_idx"
ON "CotizacionVersion"("cotizacionId");

CREATE INDEX "CotizacionVersion_creadaEn_idx"
ON "CotizacionVersion"("creadaEn");

CREATE INDEX "Cotizacion_zonaId_idx"
ON "Cotizacion"("zonaId");

CREATE INDEX "Cotizacion_origenPublico_idx"
ON "Cotizacion"("origenPublico");

CREATE INDEX "Cotizacion_editablePublica_idx"
ON "Cotizacion"("editablePublica");

ALTER TABLE "Cotizacion"
ADD CONSTRAINT "Cotizacion_zonaId_fkey"
FOREIGN KEY ("zonaId") REFERENCES "Zona"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CotizacionVersion"
ADD CONSTRAINT "CotizacionVersion_cotizacionId_fkey"
FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
