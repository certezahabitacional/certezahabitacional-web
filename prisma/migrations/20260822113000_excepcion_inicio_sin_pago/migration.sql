ALTER TABLE "public"."Inspeccion"
ADD COLUMN "inicioLiberadoSinPago" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "inicioLiberadoPorId" TEXT,
ADD COLUMN "inicioLiberadoEn" TIMESTAMP(3),
ADD COLUMN "motivoLiberacionPago" TEXT;

CREATE INDEX "Inspeccion_inicioLiberadoPorId_idx"
ON "public"."Inspeccion"("inicioLiberadoPorId");