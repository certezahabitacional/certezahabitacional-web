-- AlterTable
ALTER TABLE "public"."Cliente" ADD COLUMN     "codigoPostal" TEXT,
ADD COLUMN     "colonia" TEXT,
ADD COLUMN     "curp" TEXT,
ADD COLUMN     "estado" TEXT,
ADD COLUMN     "rfc" TEXT;

-- AlterTable
ALTER TABLE "public"."Hallazgo" ADD COLUMN     "costoEstimado" DECIMAL(12,2),
ADD COLUMN     "responsable" TEXT,
ADD COLUMN     "tiempoReparacion" TEXT;

-- AlterTable
ALTER TABLE "public"."Inspeccion" ADD COLUMN     "inmuebleId" TEXT;

-- CreateTable
CREATE TABLE "public"."Inmueble" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "colonia" TEXT,
    "ciudad" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "codigoPostal" TEXT,
    "latitud" DECIMAL(10,7),
    "longitud" DECIMAL(10,7),
    "superficieTerrenoM2" DECIMAL(10,2),
    "superficieConstruccionM2" DECIMAL(10,2),
    "anioConstruccion" INTEGER,
    "constructor" TEXT,
    "desarrollo" TEXT,
    "numeroEscritura" TEXT,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inmueble_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inmueble_clienteId_idx" ON "public"."Inmueble"("clienteId");

-- CreateIndex
CREATE INDEX "Inmueble_ciudad_idx" ON "public"."Inmueble"("ciudad");

-- CreateIndex
CREATE INDEX "Cliente_rfc_idx" ON "public"."Cliente"("rfc");

-- CreateIndex
CREATE INDEX "Inspeccion_inmuebleId_idx" ON "public"."Inspeccion"("inmuebleId");

-- AddForeignKey
ALTER TABLE "public"."Inmueble" ADD CONSTRAINT "Inmueble_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inspeccion" ADD CONSTRAINT "Inspeccion_inmuebleId_fkey" FOREIGN KEY ("inmuebleId") REFERENCES "public"."Inmueble"("id") ON DELETE SET NULL ON UPDATE CASCADE;
