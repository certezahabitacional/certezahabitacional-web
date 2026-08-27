-- CreateEnum
CREATE TYPE "public"."EsquemaPago" AS ENUM ('UNA_EXHIBICION', 'DOS_EXHIBICIONES_50_50');

-- AlterTable
ALTER TABLE "public"."Cotizacion"
ADD COLUMN "esquemaPago" "public"."EsquemaPago" NOT NULL DEFAULT 'UNA_EXHIBICION',
ADD COLUMN "montoPagado" DECIMAL(12,2) NOT NULL DEFAULT 0;