CREATE TABLE IF NOT EXISTS "RegistroModuloPM" (
  "id" TEXT PRIMARY KEY,
  "proyectoId" TEXT NOT NULL,
  "actividadOrigenId" TEXT NOT NULL,
  "modulo" TEXT NOT NULL,
  "clave" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "descripcion" TEXT,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "responsable" TEXT,
  "fechaPlan" DATE,
  "fechaReal" DATE,
  "importePlan" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "importeReal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "bloqueante" BOOLEAN NOT NULL DEFAULT false,
  "entregable" TEXT,
  "fuenteDocumento" TEXT,
  "datos" JSONB,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegistroModuloPM_proyectoId_fkey"
    FOREIGN KEY ("proyectoId") REFERENCES "ProyectoPM"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RegistroModuloPM_actividadOrigenId_fkey"
    FOREIGN KEY ("actividadOrigenId") REFERENCES "ActividadDocumentoMaestroPM"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RegistroModuloPM_actividadOrigenId_modulo_key" UNIQUE ("actividadOrigenId","modulo")
);

CREATE INDEX IF NOT EXISTS "RegistroModuloPM_proyectoId_idx" ON "RegistroModuloPM"("proyectoId");
CREATE INDEX IF NOT EXISTS "RegistroModuloPM_modulo_idx" ON "RegistroModuloPM"("modulo");
CREATE INDEX IF NOT EXISTS "RegistroModuloPM_estado_idx" ON "RegistroModuloPM"("estado");
CREATE INDEX IF NOT EXISTS "RegistroModuloPM_fechaPlan_idx" ON "RegistroModuloPM"("fechaPlan");

CREATE TABLE IF NOT EXISTS "SeguimientoActividadPM" (
  "id" TEXT PRIMARY KEY,
  "proyectoId" TEXT NOT NULL,
  "actividadOrigenId" TEXT NOT NULL UNIQUE,
  "periodicidad" TEXT NOT NULL,
  "responsable" TEXT,
  "proximaRevision" DATE,
  "ultimaRevision" DATE,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "requiereActualizacion" BOOLEAN NOT NULL DEFAULT true,
  "valorActual" TEXT,
  "porcentajeAvance" DECIMAL(5,2),
  "comentario" TEXT,
  "evidenciaUrl" TEXT,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeguimientoActividadPM_proyectoId_fkey"
    FOREIGN KEY ("proyectoId") REFERENCES "ProyectoPM"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SeguimientoActividadPM_actividadOrigenId_fkey"
    FOREIGN KEY ("actividadOrigenId") REFERENCES "ActividadDocumentoMaestroPM"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SeguimientoActividadPM_proyectoId_idx" ON "SeguimientoActividadPM"("proyectoId");
CREATE INDEX IF NOT EXISTS "SeguimientoActividadPM_proximaRevision_idx" ON "SeguimientoActividadPM"("proximaRevision");
CREATE INDEX IF NOT EXISTS "SeguimientoActividadPM_estado_idx" ON "SeguimientoActividadPM"("estado");
CREATE INDEX IF NOT EXISTS "SeguimientoActividadPM_requiereActualizacion_idx" ON "SeguimientoActividadPM"("requiereActualizacion");

ALTER TABLE "RegistroModuloPM" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SeguimientoActividadPM" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "RegistroModuloPM" FROM anon, authenticated;
REVOKE ALL ON TABLE "SeguimientoActividadPM" FROM anon, authenticated;
