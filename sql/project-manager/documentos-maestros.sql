CREATE TABLE IF NOT EXISTS "DocumentoMaestroPM" (
  "id" TEXT PRIMARY KEY,
  "proyectoId" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT,
  "tipo" TEXT NOT NULL,
  "obligatorio" BOOLEAN NOT NULL DEFAULT true,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "origen" TEXT NOT NULL DEFAULT 'CONSTRUCTIBILIDAD',
  "moduloPrincipal" TEXT,
  "modulosDestino" JSONB,
  "periodicidadDefault" TEXT,
  "reglasConfiguracion" JSONB,
  "archivoReferenciaUrl" TEXT,
  "archivoReferenciaNombre" TEXT,
  "generadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentoMaestroPM_proyectoId_fkey"
    FOREIGN KEY ("proyectoId") REFERENCES "ProyectoPM"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DocumentoMaestroPM_proyectoId_codigo_key" UNIQUE ("proyectoId","codigo")
);

CREATE INDEX IF NOT EXISTS "DocumentoMaestroPM_proyectoId_idx" ON "DocumentoMaestroPM"("proyectoId");
CREATE INDEX IF NOT EXISTS "DocumentoMaestroPM_estado_idx" ON "DocumentoMaestroPM"("estado");
CREATE INDEX IF NOT EXISTS "DocumentoMaestroPM_tipo_idx" ON "DocumentoMaestroPM"("tipo");

CREATE TABLE IF NOT EXISTS "ActividadDocumentoMaestroPM" (
  "id" TEXT PRIMARY KEY,
  "documentoMaestroId" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "actividad" TEXT NOT NULL,
  "descripcion" TEXT,
  "tipo" TEXT,
  "etapa" TEXT,
  "predecesoras" JSONB,
  "dependencia" TEXT,
  "responsable" TEXT,
  "organismo" TEXT,
  "fechaInicioPlan" DATE,
  "fechaFinPlan" DATE,
  "fechaInicioReal" DATE,
  "fechaFinReal" DATE,
  "duracionDias" INTEGER,
  "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "prioridad" TEXT NOT NULL DEFAULT 'MEDIA',
  "entregable" TEXT,
  "evidenciaUrl" TEXT,
  "costoPresupuestado" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "costoReal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "criterioAceptacion" TEXT,
  "bloqueante" BOOLEAN NOT NULL DEFAULT false,
  "modulosDestino" JSONB,
  "indicador" TEXT,
  "periodicidad" TEXT,
  "reglaAlerta" TEXT,
  "origen" TEXT NOT NULL DEFAULT 'AUTOMATICO',
  "notas" TEXT,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActividadDocumentoMaestroPM_documentoMaestroId_fkey"
    FOREIGN KEY ("documentoMaestroId") REFERENCES "DocumentoMaestroPM"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ActividadDocumentoMaestroPM_documentoMaestroId_codigo_key" UNIQUE ("documentoMaestroId","codigo")
);

CREATE INDEX IF NOT EXISTS "ActividadDocumentoMaestroPM_documentoMaestroId_idx" ON "ActividadDocumentoMaestroPM"("documentoMaestroId");
CREATE INDEX IF NOT EXISTS "ActividadDocumentoMaestroPM_estado_idx" ON "ActividadDocumentoMaestroPM"("estado");
CREATE INDEX IF NOT EXISTS "ActividadDocumentoMaestroPM_bloqueante_idx" ON "ActividadDocumentoMaestroPM"("bloqueante");
CREATE INDEX IF NOT EXISTS "ActividadDocumentoMaestroPM_periodicidad_idx" ON "ActividadDocumentoMaestroPM"("periodicidad");

ALTER TABLE "DocumentoMaestroPM" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActividadDocumentoMaestroPM" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "DocumentoMaestroPM" FROM anon, authenticated;
REVOKE ALL ON TABLE "ActividadDocumentoMaestroPM" FROM anon, authenticated;
