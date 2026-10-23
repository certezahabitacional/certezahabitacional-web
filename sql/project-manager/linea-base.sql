CREATE TABLE IF NOT EXISTS "LineaBasePM" (
  "id" TEXT PRIMARY KEY,
  "proyectoId" TEXT NOT NULL UNIQUE,
  "version" INTEGER NOT NULL DEFAULT 1,
  "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
  "alcance" JSONB,
  "presupuesto" JSONB,
  "programa" JSONB,
  "estructuraFisica" JSONB,
  "contratos" JSONB,
  "expedienteResumen" JSONB,
  "liberaciones" JSONB,
  "indicadoresBase" JSONB,
  "riesgosBase" JSONB,
  "cambiosBase" JSONB,
  "aprobadoPorId" TEXT,
  "aprobadoEn" TIMESTAMP(3),
  "motivoAprobacion" TEXT,
  "hashReferencia" TEXT,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LineaBasePM_proyectoId_fkey"
    FOREIGN KEY ("proyectoId") REFERENCES "ProyectoPM"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "LineaBasePM_estado_idx" ON "LineaBasePM"("estado");
CREATE INDEX IF NOT EXISTS "LineaBasePM_version_idx" ON "LineaBasePM"("version");
