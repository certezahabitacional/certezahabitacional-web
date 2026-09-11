-- Fase 1: Vendedor, aceptacion, Caja, pagos y liberaciones.
ALTER TYPE "RolUsuario" ADD VALUE IF NOT EXISTS 'VENDEDOR';

ALTER TABLE "Cotizacion"
ADD COLUMN "aceptadaEn" TIMESTAMP(3),
ADD COLUMN "excepcionApertura" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "excepcionAperturaPorId" TEXT,
ADD COLUMN "excepcionAperturaEn" TIMESTAMP(3),
ADD COLUMN "motivoExcepcionApertura" TEXT,
ADD COLUMN "excepcionInicio" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "excepcionInicioPorId" TEXT,
ADD COLUMN "excepcionInicioEn" TIMESTAMP(3),
ADD COLUMN "motivoExcepcionInicio" TEXT;

CREATE TABLE "PagoCotizacion" (
"id" TEXT NOT NULL, "cotizacionId" TEXT NOT NULL, "monto" DECIMAL(12,2) NOT NULL,
"fechaPago" TIMESTAMP(3) NOT NULL, "referencia" TEXT, "metodoPago" TEXT, "notas" TEXT,
"registradoPorId" TEXT NOT NULL, "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "PagoCotizacion_pkey" PRIMARY KEY ("id"));

CREATE TABLE "ObservacionAgenda" (
"id" TEXT NOT NULL, "cotizacionId" TEXT NOT NULL, "observacion" TEXT NOT NULL,
"registradaPorId" TEXT NOT NULL, "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"actualizadaEn" TIMESTAMP(3) NOT NULL,
CONSTRAINT "ObservacionAgenda_pkey" PRIMARY KEY ("id"));

CREATE INDEX "Cotizacion_aceptadaEn_idx" ON "Cotizacion"("aceptadaEn");
CREATE INDEX "Cotizacion_autorizadaEn_idx" ON "Cotizacion"("autorizadaEn");
CREATE INDEX "Cotizacion_excepcionApertura_idx" ON "Cotizacion"("excepcionApertura");
CREATE INDEX "Cotizacion_excepcionInicio_idx" ON "Cotizacion"("excepcionInicio");
CREATE INDEX "PagoCotizacion_cotizacionId_idx" ON "PagoCotizacion"("cotizacionId");
CREATE INDEX "PagoCotizacion_fechaPago_idx" ON "PagoCotizacion"("fechaPago");
CREATE INDEX "PagoCotizacion_registradoPorId_idx" ON "PagoCotizacion"("registradoPorId");
CREATE INDEX "ObservacionAgenda_cotizacionId_idx" ON "ObservacionAgenda"("cotizacionId");
CREATE INDEX "ObservacionAgenda_registradaPorId_idx" ON "ObservacionAgenda"("registradaPorId");
CREATE INDEX "ObservacionAgenda_creadaEn_idx" ON "ObservacionAgenda"("creadaEn");

ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_excepcionAperturaPorId_fkey" FOREIGN KEY ("excepcionAperturaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_excepcionInicioPorId_fkey" FOREIGN KEY ("excepcionInicioPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PagoCotizacion" ADD CONSTRAINT "PagoCotizacion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PagoCotizacion" ADD CONSTRAINT "PagoCotizacion_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ObservacionAgenda" ADD CONSTRAINT "ObservacionAgenda_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ObservacionAgenda" ADD CONSTRAINT "ObservacionAgenda_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
