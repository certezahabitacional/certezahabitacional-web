CREATE TABLE IF NOT EXISTS "ConstructibilidadPM" (
  "id" TEXT PRIMARY KEY,
  "proyectoId" TEXT NOT NULL UNIQUE,
  "condicionPredio" TEXT,
  "clasificacionDetalle" TEXT,
  "superficieM2" DECIMAL(14,2),
  "numeroPredios" INTEGER,
  "disponibilidadFisica" TEXT,
  "zonasMixtas" JSONB,
  "identificacion" JSONB,
  "limitesAccesos" JSONB,
  "topografiaSuelo" JSONB,
  "aguaDrenajeNatural" JSONB,
  "interferencias" JSONB,
  "urbanizacionExistente" JSONB,
  "entregablesPaso1" JSONB,
  "riesgosPaso1" JSONB,
  "modulosSugeridos" JSONB,
  "progresoPaso1" INTEGER NOT NULL DEFAULT 0,
  "estadoPaso1" TEXT NOT NULL DEFAULT 'BORRADOR',
  "actualizadoPorId" TEXT,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConstructibilidadPM_proyectoId_fkey"
    FOREIGN KEY ("proyectoId") REFERENCES "ProyectoPM"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ConstructibilidadPM_condicionPredio_idx" ON "ConstructibilidadPM"("condicionPredio");
CREATE INDEX IF NOT EXISTS "ConstructibilidadPM_estadoPaso1_idx" ON "ConstructibilidadPM"("estadoPaso1");
