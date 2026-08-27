-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."EstadoCotizacion" ADD VALUE 'PENDIENTE_AUTORIZACION';
ALTER TYPE "public"."EstadoCotizacion" ADD VALUE 'AUTORIZADA';

-- AlterTable
ALTER TABLE "public"."Cotizacion" ADD COLUMN     "autorizadaEn" TIMESTAMP(3),
ADD COLUMN     "autorizadaPorId" TEXT,
ADD COLUMN     "motivoRechazo" TEXT,
ADD COLUMN     "rechazadaEn" TIMESTAMP(3),
ADD COLUMN     "rechazadaPorId" TEXT,
ADD COLUMN     "solicitudAutorizacionEn" TIMESTAMP(3),
ADD COLUMN     "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Ciudad_Juarez';

-- AddForeignKey
ALTER TABLE "public"."Cotizacion" ADD CONSTRAINT "Cotizacion_autorizadaPorId_fkey" FOREIGN KEY ("autorizadaPorId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cotizacion" ADD CONSTRAINT "Cotizacion_rechazadaPorId_fkey" FOREIGN KEY ("rechazadaPorId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

