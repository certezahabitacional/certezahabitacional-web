-- Biblioteca central de rendimientos para Certeza ÁBACO.
-- Se mantiene sin políticas públicas: el acceso de la aplicación se realiza
-- exclusivamente desde el backend autenticado mediante Prisma.

CREATE TABLE "RendimientoAbaco" (
  "id" TEXT NOT NULL,
  "clave" TEXT NOT NULL,
  "descripcionNormalizada" TEXT NOT NULL,
  "descripcionEjemplo" TEXT NOT NULL,
  "unidad" TEXT NOT NULL,
  "cuadrilla" TEXT NOT NULL,
  "rendimiento" DECIMAL(14,4) NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "origen" TEXT NOT NULL DEFAULT 'MANUAL',
  "creadoPorId" TEXT,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RendimientoAbaco_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RendimientoAbaco_clave_key"
  ON "RendimientoAbaco"("clave");

CREATE INDEX "RendimientoAbaco_unidad_idx"
  ON "RendimientoAbaco"("unidad");

CREATE INDEX "RendimientoAbaco_cuadrilla_idx"
  ON "RendimientoAbaco"("cuadrilla");

CREATE INDEX "RendimientoAbaco_activo_idx"
  ON "RendimientoAbaco"("activo");

CREATE INDEX "RendimientoAbaco_creadoPorId_idx"
  ON "RendimientoAbaco"("creadoPorId");

ALTER TABLE "RendimientoAbaco"
  ADD CONSTRAINT "RendimientoAbaco_creadoPorId_fkey"
  FOREIGN KEY ("creadoPorId")
  REFERENCES "Usuario"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "RendimientoAbaco" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "RendimientoAbaco" FROM anon;
REVOKE ALL ON TABLE "RendimientoAbaco" FROM authenticated;
