-- Estado de cuenta de comisiones para vendedores e inspectores.
-- Se registra únicamente el pago efectuado; la comisión generada se calcula
-- desde el importe autorizado de la cotización (10% vendedor, 30% inspector).

CREATE TABLE "PagoComision" (
  "id" TEXT NOT NULL,
  "cotizacionId" TEXT NOT NULL,
  "beneficiarioId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "monto" DECIMAL(12,2) NOT NULL,
  "fechaPago" TIMESTAMP(3) NOT NULL,
  "metodoPago" TEXT,
  "referencia" TEXT,
  "notas" TEXT,
  "registradoPorId" TEXT NOT NULL,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PagoComision_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PagoComision"
  ADD CONSTRAINT "PagoComision_cotizacionId_fkey"
  FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PagoComision"
  ADD CONSTRAINT "PagoComision_beneficiarioId_fkey"
  FOREIGN KEY ("beneficiarioId") REFERENCES "Usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PagoComision"
  ADD CONSTRAINT "PagoComision_registradoPorId_fkey"
  FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PagoComision"
  ADD CONSTRAINT "PagoComision_tipo_check"
  CHECK ("tipo" IN ('VENDEDOR', 'INSPECTOR'));

ALTER TABLE "PagoComision"
  ADD CONSTRAINT "PagoComision_monto_check"
  CHECK ("monto" > 0);

CREATE INDEX "PagoComision_cotizacionId_idx" ON "PagoComision"("cotizacionId");
CREATE INDEX "PagoComision_beneficiarioId_idx" ON "PagoComision"("beneficiarioId");
CREATE INDEX "PagoComision_fechaPago_idx" ON "PagoComision"("fechaPago");
CREATE INDEX "PagoComision_tipo_idx" ON "PagoComision"("tipo");
