CREATE TABLE "AbacoProyecto" (
  "id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "creadoPorId" TEXT NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AbacoProyecto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AbacoCorte" (
  "id" TEXT NOT NULL,
  "proyectoId" TEXT NOT NULL,
  "fechaCorte" TIMESTAMP(3) NOT NULL,
  "avanceReal" JSONB NOT NULL,
  "resumen" JSONB,
  "registradoPorId" TEXT NOT NULL,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AbacoCorte_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AbacoProyecto_creadoPorId_nombre_key" ON "AbacoProyecto"("creadoPorId","nombre");
CREATE INDEX "AbacoProyecto_creadoPorId_idx" ON "AbacoProyecto"("creadoPorId");
CREATE INDEX "AbacoProyecto_activo_idx" ON "AbacoProyecto"("activo");
CREATE INDEX "AbacoProyecto_actualizadoEn_idx" ON "AbacoProyecto"("actualizadoEn");

CREATE UNIQUE INDEX "AbacoCorte_proyectoId_fechaCorte_key" ON "AbacoCorte"("proyectoId","fechaCorte");
CREATE INDEX "AbacoCorte_proyectoId_idx" ON "AbacoCorte"("proyectoId");
CREATE INDEX "AbacoCorte_fechaCorte_idx" ON "AbacoCorte"("fechaCorte");
CREATE INDEX "AbacoCorte_registradoPorId_idx" ON "AbacoCorte"("registradoPorId");

ALTER TABLE "AbacoProyecto"
ADD CONSTRAINT "AbacoProyecto_creadoPorId_fkey"
FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AbacoCorte"
ADD CONSTRAINT "AbacoCorte_proyectoId_fkey"
FOREIGN KEY ("proyectoId") REFERENCES "AbacoProyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AbacoCorte"
ADD CONSTRAINT "AbacoCorte_registradoPorId_fkey"
FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AbacoProyecto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AbacoCorte" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "AbacoProyecto" FROM anon, authenticated;
REVOKE ALL ON TABLE "AbacoCorte" FROM anon, authenticated;
