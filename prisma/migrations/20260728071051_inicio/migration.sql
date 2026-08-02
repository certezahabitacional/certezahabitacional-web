-- CreateEnum
CREATE TYPE "public"."RolUsuario" AS ENUM ('ADMINISTRADOR', 'SUPERVISOR', 'INSPECTOR', 'CLIENTE');

-- CreateEnum
CREATE TYPE "public"."EstadoInspeccion" AS ENUM ('PROGRAMADA', 'EN_PROCESO', 'REPORTE_PENDIENTE', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "public"."TipoCliente" AS ENUM ('PARTICULAR', 'INMOBILIARIA', 'CONSTRUCTORA', 'INVERSIONISTA');

-- CreateEnum
CREATE TYPE "public"."ClasificacionHallazgo" AS ENUM ('C', 'O', 'NC', 'CR', 'NA');

-- CreateEnum
CREATE TYPE "public"."PrioridadHallazgo" AS ENUM ('P1', 'P2', 'P3', 'P4', 'P5');

-- CreateTable
CREATE TABLE "public"."Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "public"."RolUsuario" NOT NULL DEFAULT 'INSPECTOR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcceso" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Cliente" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "correo" TEXT,
    "tipo" "public"."TipoCliente" NOT NULL DEFAULT 'PARTICULAR',
    "empresa" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Inspector" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "telefono" TEXT,
    "especialidad" TEXT,
    "cedula" TEXT,
    "ciudad" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Inspeccion" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "inspectorId" TEXT,
    "tipoServicio" TEXT NOT NULL,
    "tipoInmueble" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "superficieM2" DECIMAL(10,2),
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "estado" "public"."EstadoInspeccion" NOT NULL DEFAULT 'PROGRAMADA',
    "observaciones" TEXT,
    "ish" DECIMAL(5,2),
    "semaforo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspeccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Hallazgo" (
    "id" TEXT NOT NULL,
    "inspeccionId" TEXT NOT NULL,
    "creadoPorId" TEXT,
    "area" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "clasificacion" "public"."ClasificacionHallazgo" NOT NULL,
    "prioridad" "public"."PrioridadHallazgo" NOT NULL,
    "recomendacion" TEXT,
    "ubicacion" TEXT,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hallazgo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Fotografia" (
    "id" TEXT NOT NULL,
    "inspeccionId" TEXT NOT NULL,
    "hallazgoId" TEXT,
    "subidaPorId" TEXT,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "descripcion" TEXT,
    "latitud" DECIMAL(10,7),
    "longitud" DECIMAL(10,7),
    "tomadaEn" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fotografia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Firma" (
    "id" TEXT NOT NULL,
    "inspeccionId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombreFirmante" TEXT NOT NULL,
    "imagenUrl" TEXT NOT NULL,
    "firmadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "Firma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Certificado" (
    "id" TEXT NOT NULL,
    "inspeccionId" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "codigoValidacion" TEXT NOT NULL,
    "dictamen" TEXT NOT NULL,
    "ish" DECIMAL(5,2) NOT NULL,
    "emitidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfUrl" TEXT,
    "vigente" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Certificado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "public"."Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_usuarioId_key" ON "public"."Cliente"("usuarioId");

-- CreateIndex
CREATE INDEX "Cliente_nombre_idx" ON "public"."Cliente"("nombre");

-- CreateIndex
CREATE INDEX "Cliente_correo_idx" ON "public"."Cliente"("correo");

-- CreateIndex
CREATE INDEX "Cliente_telefono_idx" ON "public"."Cliente"("telefono");

-- CreateIndex
CREATE UNIQUE INDEX "Inspector_usuarioId_key" ON "public"."Inspector"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Inspeccion_folio_key" ON "public"."Inspeccion"("folio");

-- CreateIndex
CREATE INDEX "Inspeccion_fechaProgramada_idx" ON "public"."Inspeccion"("fechaProgramada");

-- CreateIndex
CREATE INDEX "Inspeccion_estado_idx" ON "public"."Inspeccion"("estado");

-- CreateIndex
CREATE INDEX "Inspeccion_clienteId_idx" ON "public"."Inspeccion"("clienteId");

-- CreateIndex
CREATE INDEX "Inspeccion_inspectorId_idx" ON "public"."Inspeccion"("inspectorId");

-- CreateIndex
CREATE INDEX "Hallazgo_inspeccionId_idx" ON "public"."Hallazgo"("inspeccionId");

-- CreateIndex
CREATE INDEX "Hallazgo_clasificacion_idx" ON "public"."Hallazgo"("clasificacion");

-- CreateIndex
CREATE INDEX "Hallazgo_prioridad_idx" ON "public"."Hallazgo"("prioridad");

-- CreateIndex
CREATE UNIQUE INDEX "Fotografia_publicId_key" ON "public"."Fotografia"("publicId");

-- CreateIndex
CREATE INDEX "Fotografia_inspeccionId_idx" ON "public"."Fotografia"("inspeccionId");

-- CreateIndex
CREATE INDEX "Fotografia_hallazgoId_idx" ON "public"."Fotografia"("hallazgoId");

-- CreateIndex
CREATE INDEX "Firma_inspeccionId_idx" ON "public"."Firma"("inspeccionId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificado_inspeccionId_key" ON "public"."Certificado"("inspeccionId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificado_folio_key" ON "public"."Certificado"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "Certificado_codigoValidacion_key" ON "public"."Certificado"("codigoValidacion");

-- AddForeignKey
ALTER TABLE "public"."Cliente" ADD CONSTRAINT "Cliente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inspector" ADD CONSTRAINT "Inspector_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inspeccion" ADD CONSTRAINT "Inspeccion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "public"."Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Inspeccion" ADD CONSTRAINT "Inspeccion_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "public"."Inspector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Hallazgo" ADD CONSTRAINT "Hallazgo_inspeccionId_fkey" FOREIGN KEY ("inspeccionId") REFERENCES "public"."Inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Hallazgo" ADD CONSTRAINT "Hallazgo_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Fotografia" ADD CONSTRAINT "Fotografia_inspeccionId_fkey" FOREIGN KEY ("inspeccionId") REFERENCES "public"."Inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Fotografia" ADD CONSTRAINT "Fotografia_hallazgoId_fkey" FOREIGN KEY ("hallazgoId") REFERENCES "public"."Hallazgo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Fotografia" ADD CONSTRAINT "Fotografia_subidaPorId_fkey" FOREIGN KEY ("subidaPorId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Firma" ADD CONSTRAINT "Firma_inspeccionId_fkey" FOREIGN KEY ("inspeccionId") REFERENCES "public"."Inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Certificado" ADD CONSTRAINT "Certificado_inspeccionId_fkey" FOREIGN KEY ("inspeccionId") REFERENCES "public"."Inspeccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
