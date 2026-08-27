/*
  Warnings:

  - The values [SUPERVISOR] on the enum `RolUsuario` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."RolUsuario_new" AS ENUM ('DIRECTOR', 'ADMINISTRADOR', 'GERENTE', 'COORDINADOR', 'INSPECTOR', 'CLIENTE');
ALTER TABLE "public"."Usuario" ALTER COLUMN "rol" DROP DEFAULT;
ALTER TABLE "public"."Usuario" ALTER COLUMN "rol" TYPE "public"."RolUsuario_new" USING ("rol"::text::"public"."RolUsuario_new");
ALTER TABLE "public"."RevisionInspeccion" ALTER COLUMN "rol" TYPE "public"."RolUsuario_new" USING ("rol"::text::"public"."RolUsuario_new");
ALTER TYPE "public"."RolUsuario" RENAME TO "RolUsuario_old";
ALTER TYPE "public"."RolUsuario_new" RENAME TO "RolUsuario";
DROP TYPE "public"."RolUsuario_old";
ALTER TABLE "public"."Usuario" ALTER COLUMN "rol" SET DEFAULT 'INSPECTOR';
COMMIT;

-- AlterTable
ALTER TABLE "public"."Inspeccion" ADD COLUMN     "zonaId" TEXT;

-- AlterTable
ALTER TABLE "public"."Usuario" ADD COLUMN     "coordinadorId" TEXT,
ADD COLUMN     "gerenteId" TEXT,
ADD COLUMN     "zonaId" TEXT;

-- CreateTable
CREATE TABLE "public"."Zona" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "ciudad" TEXT,
    "estado" TEXT,
    "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Ciudad_Juarez',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zona_codigo_key" ON "public"."Zona"("codigo");

-- CreateIndex
CREATE INDEX "Zona_nombre_idx" ON "public"."Zona"("nombre");

-- CreateIndex
CREATE INDEX "Zona_activa_idx" ON "public"."Zona"("activa");

-- CreateIndex
CREATE INDEX "Inspeccion_zonaId_idx" ON "public"."Inspeccion"("zonaId");

-- CreateIndex
CREATE INDEX "Usuario_zonaId_idx" ON "public"."Usuario"("zonaId");

-- CreateIndex
CREATE INDEX "Usuario_gerenteId_idx" ON "public"."Usuario"("gerenteId");

-- CreateIndex
CREATE INDEX "Usuario_coordinadorId_idx" ON "public"."Usuario"("coordinadorId");

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "public"."Zona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_gerenteId_fkey" FOREIGN KEY ("gerenteId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_coordinadorId_fkey" FOREIGN KEY ("coordinadorId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inspeccion" ADD CONSTRAINT "Inspeccion_zonaId_fkey" FOREIGN KEY ("zonaId") REFERENCES "public"."Zona"("id") ON DELETE SET NULL ON UPDATE CASCADE;
