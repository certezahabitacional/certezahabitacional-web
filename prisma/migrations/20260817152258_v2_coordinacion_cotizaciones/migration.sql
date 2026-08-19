/*
  Warnings:

  - A unique constraint covering the columns `[cotizacionId]` on the table `Inspeccion` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."TipoCalculoPrecio" AS ENUM ('PRECIO_FIJO', 'POR_M2', 'HIBRIDO');

-- CreateEnum
CREATE TYPE "public"."EstadoCotizacion" AS ENUM ('BORRADOR', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'VENCIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "public"."EstadoPago" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADO', 'CANCELADO');

-- AlterEnum
ALTER TYPE "public"."RolUsuario" ADD VALUE 'COORDINADOR';

-- AlterTable
ALTER TABLE "public"."Inspeccion" ADD COLUMN     "agendadaPorId" TEXT,
ADD COLUMN     "cotizacionId" TEXT;

-- CreateTable
CREATE TABLE "public"."PaqueteServicio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipoCalculo" "public"."TipoCalculoPrecio" NOT NULL DEFAULT 'HIBRIDO',
    "precioBase" DECIMAL(12,2) NOT NULL,
    "superficieIncluidaM2" DECIMAL(10,2),
    "precioM2Adicional" DECIMAL(12,2),
    "superficieMinimaM2" DECIMAL(10,2),
    "superficieMaximaM2" DECIMAL(10,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaqueteServicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Cotizacion" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "inmuebleId" TEXT,
    "paqueteId" TEXT,
    "creadaPorId" TEXT,
    "superficieM2" DECIMAL(10,2),
    "precioBase" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "metrosAdicionales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cargoMetrosAdicionales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cargosExtra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" "public"."EstadoCotizacion" NOT NULL DEFAULT 'BORRADOR',
    "estadoPago" "public"."EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "vigenciaHasta" TIMESTAMP(3),
    "notas" TEXT,
    "observacionesInternas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaqueteServicio_codigo_key" ON "public"."PaqueteServicio"("codigo");

-- CreateIndex
CREATE INDEX "PaqueteServicio_activo_idx" ON "public"."PaqueteServicio"("activo");

-- CreateIndex
CREATE INDEX "PaqueteServicio_orden_idx" ON "public"."PaqueteServicio"("orden");

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_folio_key" ON "public"."Cotizacion"("folio");

-- CreateIndex
CREATE INDEX "Cotizacion_clienteId_idx" ON "public"."Cotizacion"("clienteId");

-- CreateIndex
CREATE INDEX "Cotizacion_inmuebleId_idx" ON "public"."Cotizacion"("inmuebleId");

-- CreateIndex
CREATE INDEX "Cotizacion_paqueteId_idx" ON "public"."Cotizacion"("paqueteId");

-- CreateIndex
CREATE INDEX "Cotizacion_creadaPorId_idx" ON "public"."Cotizacion"("creadaPorId");

-- CreateIndex
CREATE INDEX "Cotizacion_estado_idx" ON "public"."Cotizacion"("estado");

-- CreateIndex
CREATE INDEX "Cotizacion_estadoPago_idx" ON "public"."Cotizacion"("estadoPago");

-- CreateIndex
CREATE INDEX "Cotizacion_creadoEn_idx" ON "public"."Cotizacion"("creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "Inspeccion_cotizacionId_key" ON "public"."Inspeccion"("cotizacionId");

-- CreateIndex
CREATE INDEX "Inspeccion_agendadaPorId_idx" ON "public"."Inspeccion"("agendadaPorId");

-- AddForeignKey
ALTER TABLE "public"."Inspeccion" ADD CONSTRAINT "Inspeccion_agendadaPorId_fkey" FOREIGN KEY ("agendadaPorId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inspeccion" ADD CONSTRAINT "Inspeccion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "public"."Cotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cotizacion" ADD CONSTRAINT "Cotizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cotizacion" ADD CONSTRAINT "Cotizacion_inmuebleId_fkey" FOREIGN KEY ("inmuebleId") REFERENCES "public"."Inmueble"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cotizacion" ADD CONSTRAINT "Cotizacion_paqueteId_fkey" FOREIGN KEY ("paqueteId") REFERENCES "public"."PaqueteServicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cotizacion" ADD CONSTRAINT "Cotizacion_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
