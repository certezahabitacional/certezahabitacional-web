CREATE TABLE IF NOT EXISTS "RecalculoDocumentoMaestroPM" (
  "id" TEXT PRIMARY KEY,
  "proyectoId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "motivo" TEXT,
  "resumen" JSONB NOT NULL,
  "constructibilidadSnapshot" JSONB,
  "lineaBaseEstado" TEXT,
  "lineaBaseVersion" INTEGER,
  "posteriorLineaBase" BOOLEAN NOT NULL DEFAULT false,
  "aplicadoPorId" TEXT,
  "aplicadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecalculoDocumentoMaestroPM_proyectoId_fkey"
    FOREIGN KEY ("proyectoId") REFERENCES "ProyectoPM"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecalculoDocumentoMaestroPM_aplicadoPorId_fkey"
    FOREIGN KEY ("aplicadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RecalculoDocumentoMaestroPM_proyectoId_version_key" UNIQUE ("proyectoId","version")
);
CREATE INDEX IF NOT EXISTS "RecalculoDocumentoMaestroPM_proyectoId_idx" ON "RecalculoDocumentoMaestroPM"("proyectoId");
CREATE INDEX IF NOT EXISTS "RecalculoDocumentoMaestroPM_aplicadoEn_idx" ON "RecalculoDocumentoMaestroPM"("aplicadoEn");
CREATE INDEX IF NOT EXISTS "RecalculoDocumentoMaestroPM_posteriorLineaBase_idx" ON "RecalculoDocumentoMaestroPM"("posteriorLineaBase");
ALTER TABLE "RecalculoDocumentoMaestroPM" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "RecalculoDocumentoMaestroPM" FROM anon, authenticated;