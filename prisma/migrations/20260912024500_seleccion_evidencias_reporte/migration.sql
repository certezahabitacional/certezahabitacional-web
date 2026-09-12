-- Seleccion editorial de fotografias para el reporte final.
-- La evidencia original permanece intacta; esta tabla solo decide que imagenes
-- se muestran en el reporte y en que orden.

CREATE TABLE "SeleccionEvidenciaReporte" (
  "id" TEXT NOT NULL,
  "inspeccionId" TEXT NOT NULL,
  "fotografiaId" TEXT NOT NULL,
  "seleccionada" BOOLEAN NOT NULL DEFAULT TRUE,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "notaEditorial" TEXT,
  "seleccionadaPorId" TEXT NOT NULL,
  "actualizadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeleccionEvidenciaReporte_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SeleccionEvidenciaReporte"
  ADD CONSTRAINT "SeleccionEvidenciaReporte_inspeccionId_fkey"
  FOREIGN KEY ("inspeccionId") REFERENCES "Inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeleccionEvidenciaReporte"
  ADD CONSTRAINT "SeleccionEvidenciaReporte_fotografiaId_fkey"
  FOREIGN KEY ("fotografiaId") REFERENCES "Fotografia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeleccionEvidenciaReporte"
  ADD CONSTRAINT "SeleccionEvidenciaReporte_seleccionadaPorId_fkey"
  FOREIGN KEY ("seleccionadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SeleccionEvidenciaReporte_fotografiaId_key" ON "SeleccionEvidenciaReporte"("fotografiaId");
CREATE INDEX "SeleccionEvidenciaReporte_inspeccionId_orden_idx" ON "SeleccionEvidenciaReporte"("inspeccionId","orden");
CREATE INDEX "SeleccionEvidenciaReporte_seleccionada_idx" ON "SeleccionEvidenciaReporte"("seleccionada");
