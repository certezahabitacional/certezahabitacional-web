-- Certeza Cost v1: Generadores, APU, Explosion de Insumos y Presupuestos

CREATE TYPE "TipoInsumoAPU" AS ENUM ('MATERIAL','MANO_OBRA','EQUIPO','HERRAMIENTA','SUBCONTRATO','AUXILIAR');
CREATE TYPE "EstadoTarjetaAPU" AS ENUM ('BORRADOR','EN_REVISION','APROBADA','OBSOLETA');
CREATE TYPE "EstadoPresupuestoCT" AS ENUM ('BORRADOR','EN_REVISION','APROBADO','LINEA_BASE','CERRADO');
CREATE TYPE "EstadoProyectoGeneradores" AS ENUM (
  'NUEVO','RECEPCION_DOCUMENTAL','EN_ANALISIS','CATALOGO_EN_REVISION',
  'EN_CUANTIFICACION','EN_REVISION_TECNICA','LISTO_ENTREGA','CERRADO',
  'INFORMACION_INCOMPLETA','SUSPENDIDO','EN_ESPERA_CLIENTE','PROYECTO_MODIFICADO'
);
CREATE TYPE "OrigenConceptoGeneradores" AS ENUM ('CLIENTE','CERTEZA_TECNICA','PROYECTO','MODIFICACION');
CREATE TYPE "EstadoConceptoGeneradores" AS ENUM (
  'PROPUESTO_PENDIENTE_APROBACION','APROBADO_PARA_CUANTIFICACION','EN_CUANTIFICACION',
  'REQUIERE_REVISION','REVISADO','APROBADO','CERRADO','INFORMACION_INSUFICIENTE','CAMBIO_PROYECTO'
);
CREATE TYPE "EstadoGeneradorObra" AS ENUM ('BORRADOR','EN_REVISION','OBSERVADO','APROBADO','AUTORIZADO','CERRADO');
CREATE TYPE "EstadoSolicitudInformacion" AS ENUM ('BORRADOR','PENDIENTE','RESPONDIDA','CERRADA','CANCELADA');

CREATE TABLE "ProyectoGeneradores" (
  "id" text PRIMARY KEY,
  "codigo" text NOT NULL UNIQUE,
  "nombre" text NOT NULL,
  "clienteNombre" text NOT NULL,
  "ubicacion" text,
  "tipoEdificacion" text,
  "superficieM2" numeric(14,2),
  "niveles" integer,
  "alcance" text,
  "estado" "EstadoProyectoGeneradores" NOT NULL DEFAULT 'NUEVO',
  "fechaInicio" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fechaObjetivo" timestamp(3),
  "observaciones" text,
  "creadoPorId" text NOT NULL,
  "responsableId" text,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" timestamp(3) NOT NULL,
  CONSTRAINT "ProyectoGeneradores_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProyectoGeneradores_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "DocumentoProyectoGeneradores" (
  "id" text PRIMARY KEY,
  "proyectoId" text NOT NULL,
  "nombreArchivo" text NOT NULL,
  "rutaArchivo" text,
  "tipoDocumento" text NOT NULL,
  "especialidad" text,
  "clave" text,
  "titulo" text,
  "revision" text,
  "fechaDocumento" timestamp(3),
  "fechaRecepcion" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "vigente" boolean NOT NULL DEFAULT true,
  "observaciones" text,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" timestamp(3) NOT NULL,
  CONSTRAINT "DocumentoProyectoGeneradores_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "ProyectoGeneradores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ConceptoGeneradores" (
  "id" text PRIMARY KEY,
  "proyectoId" text NOT NULL,
  "clave" text,
  "partida" text,
  "descripcion" text NOT NULL,
  "unidad" text NOT NULL,
  "origen" "OrigenConceptoGeneradores" NOT NULL,
  "estado" "EstadoConceptoGeneradores" NOT NULL DEFAULT 'PROPUESTO_PENDIENTE_APROBACION',
  "observaciones" text,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" timestamp(3) NOT NULL,
  CONSTRAINT "ConceptoGeneradores_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "ProyectoGeneradores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ElementoConstructivoGeneradores" (
  "id" text PRIMARY KEY,
  "proyectoId" text NOT NULL,
  "documentoId" text,
  "conceptoId" text,
  "clave" text,
  "tipo" text NOT NULL,
  "nivel" text,
  "eje" text,
  "tramo" text,
  "descripcion" text,
  "datosGeometricos" jsonb,
  "confianza" numeric(5,2),
  "requiereRevision" boolean NOT NULL DEFAULT true,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" timestamp(3) NOT NULL,
  CONSTRAINT "ElementoConstructivoGeneradores_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "ProyectoGeneradores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ElementoConstructivoGeneradores_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoProyectoGeneradores"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ElementoConstructivoGeneradores_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "ConceptoGeneradores"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "MedicionElementoGeneradores" (
  "id" text PRIMARY KEY,
  "elementoId" text NOT NULL,
  "magnitud" text NOT NULL,
  "unidad" text NOT NULL,
  "formula" text,
  "datos" jsonb,
  "valor" numeric(18,6) NOT NULL,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MedicionElementoGeneradores_elementoId_fkey" FOREIGN KEY ("elementoId") REFERENCES "ElementoConstructivoGeneradores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GeneradorObra" (
  "id" text PRIMARY KEY,
  "proyectoId" text NOT NULL,
  "conceptoId" text NOT NULL,
  "folio" text NOT NULL,
  "estado" "EstadoGeneradorObra" NOT NULL DEFAULT 'BORRADOR',
  "total" numeric(18,6) NOT NULL DEFAULT 0,
  "elaboradoPorId" text NOT NULL,
  "revisadoPorId" text,
  "revisadoEn" timestamp(3),
  "autorizadoPorId" text,
  "autorizadoEn" timestamp(3),
  "observaciones" text,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" timestamp(3) NOT NULL,
  CONSTRAINT "GeneradorObra_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "ProyectoGeneradores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GeneradorObra_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "ConceptoGeneradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GeneradorObra_elaboradoPorId_fkey" FOREIGN KEY ("elaboradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GeneradorObra_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "GeneradorObra_autorizadoPorId_fkey" FOREIGN KEY ("autorizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "GeneradorObra_proyectoId_folio_key" UNIQUE ("proyectoId","folio")
);

CREATE TABLE "DetalleGeneradorObra" (
  "id" text PRIMARY KEY,
  "generadorId" text NOT NULL,
  "documentoId" text,
  "eje" text,
  "tramo" text,
  "elemento" text,
  "largo" numeric(18,6),
  "ancho" numeric(18,6),
  "alto" numeric(18,6),
  "piezas" numeric(18,6),
  "factor" numeric(18,6),
  "subtotal" numeric(18,6) NOT NULL,
  "comentarios" text,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DetalleGeneradorObra_generadorId_fkey" FOREIGN KEY ("generadorId") REFERENCES "GeneradorObra"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DetalleGeneradorObra_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoProyectoGeneradores"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SolicitudInformacionGeneradores" (
  "id" text PRIMARY KEY,
  "proyectoId" text NOT NULL,
  "folio" text NOT NULL,
  "documentoReferencia" text,
  "ubicacionReferencia" text,
  "elementoReferencia" text,
  "situacion" text NOT NULL,
  "informacionRequerida" text NOT NULL,
  "respuesta" text,
  "estado" "EstadoSolicitudInformacion" NOT NULL DEFAULT 'BORRADOR',
  "fechaRespuesta" timestamp(3),
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" timestamp(3) NOT NULL,
  CONSTRAINT "SolicitudInformacionGeneradores_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "ProyectoGeneradores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SolicitudInformacionGeneradores_proyectoId_folio_key" UNIQUE ("proyectoId","folio")
);

CREATE TABLE "InconsistenciaProyectoGeneradores" (
  "id" text PRIMARY KEY,
  "proyectoId" text NOT NULL,
  "tipo" text,
  "descripcion" text NOT NULL,
  "referenciaA" text,
  "referenciaB" text,
  "severidad" text,
  "resuelta" boolean NOT NULL DEFAULT false,
  "resolucion" text,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" timestamp(3) NOT NULL,
  CONSTRAINT "InconsistenciaProyectoGeneradores_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "ProyectoGeneradores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CambioProyectoGeneradores" (
  "id" text PRIMARY KEY,
  "proyectoId" text NOT NULL,
  "conceptoId" text,
  "descripcion" text NOT NULL,
  "valorAnterior" numeric(18,6),
  "valorNuevo" numeric(18,6),
  "unidad" text,
  "documentoAnterior" text,
  "documentoNuevo" text,
  "motivo" text,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CambioProyectoGeneradores_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "ProyectoGeneradores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ReporteProyectoGeneradores" (
  "id" text PRIMARY KEY,
  "proyectoId" text NOT NULL,
  "tipo" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "rutaArchivo" text,
  "estado" text NOT NULL DEFAULT 'BORRADOR',
  "datos" jsonb,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" timestamp(3) NOT NULL,
  CONSTRAINT "ReporteProyectoGeneradores_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "ProyectoGeneradores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReporteProyectoGeneradores_proyectoId_tipo_version_key" UNIQUE ("proyectoId","tipo","version")
);

CREATE TABLE "InsumoAPU" (
  "id" text PRIMARY KEY,
  "clave" text NOT NULL UNIQUE,
  "descripcion" text NOT NULL,
  "unidad" text NOT NULL,
  "tipo" "TipoInsumoAPU" NOT NULL,
  "precioBase" numeric(18,6) NOT NULL DEFAULT 0,
  "fechaPrecio" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fuente" text,
  "ubicacionReferencia" text,
  "activo" boolean NOT NULL DEFAULT true,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" timestamp(3) NOT NULL
);

CREATE TABLE "TarjetaPrecioUnitario" (
  "id" text PRIMARY KEY,
  "proyectoId" text NOT NULL,
  "conceptoId" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "estado" "EstadoTarjetaAPU" NOT NULL DEFAULT 'BORRADOR',
  "rendimiento" numeric(18,6),
  "costoDirecto" numeric(18,6) NOT NULL DEFAULT 0,
  "porcentajeIndirectos" numeric(8,4) NOT NULL DEFAULT 0,
  "porcentajeFinanciamiento" numeric(8,4) NOT NULL DEFAULT 0,
  "porcentajeUtilidad" numeric(8,4) NOT NULL DEFAULT 0,
  "porcentajeCargosAdicionales" numeric(8,4) NOT NULL DEFAULT 0,
  "precioUnitario" numeric(18,6) NOT NULL DEFAULT 0,
  "observaciones" text,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" timestamp(3) NOT NULL,
  CONSTRAINT "TarjetaPrecioUnitario_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "ProyectoGeneradores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TarjetaPrecioUnitario_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "ConceptoGeneradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TarjetaPrecioUnitario_conceptoId_version_key" UNIQUE ("conceptoId","version")
);

CREATE TABLE "TarjetaAPUInsumo" (
  "id" text PRIMARY KEY,
  "tarjetaId" text NOT NULL,
  "insumoId" text NOT NULL,
  "cantidad" numeric(18,6) NOT NULL,
  "desperdicioPct" numeric(8,4) NOT NULL DEFAULT 0,
  "precioAplicado" numeric(18,6) NOT NULL,
  "importe" numeric(18,6) NOT NULL,
  "observaciones" text,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TarjetaAPUInsumo_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "TarjetaPrecioUnitario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TarjetaAPUInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "InsumoAPU"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ExplosionInsumosProyecto" (
  "id" text PRIMARY KEY,
  "proyectoId" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "estado" text NOT NULL DEFAULT 'BORRADOR',
  "fechaCorte" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalMateriales" numeric(18,6) NOT NULL DEFAULT 0,
  "totalManoObra" numeric(18,6) NOT NULL DEFAULT 0,
  "totalEquipo" numeric(18,6) NOT NULL DEFAULT 0,
  "totalHerramienta" numeric(18,6) NOT NULL DEFAULT 0,
  "totalSubcontratos" numeric(18,6) NOT NULL DEFAULT 0,
  "totalAuxiliares" numeric(18,6) NOT NULL DEFAULT 0,
  "totalGeneral" numeric(18,6) NOT NULL DEFAULT 0,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" timestamp(3) NOT NULL,
  CONSTRAINT "ExplosionInsumosProyecto_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "ProyectoGeneradores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExplosionInsumosProyecto_proyectoId_version_key" UNIQUE ("proyectoId","version")
);

CREATE TABLE "ExplosionInsumoDetalle" (
  "id" text PRIMARY KEY,
  "explosionId" text NOT NULL,
  "insumoId" text NOT NULL,
  "tipo" "TipoInsumoAPU" NOT NULL,
  "unidad" text NOT NULL,
  "cantidadTotal" numeric(18,6) NOT NULL DEFAULT 0,
  "precioReferencia" numeric(18,6) NOT NULL DEFAULT 0,
  "importeTotal" numeric(18,6) NOT NULL DEFAULT 0,
  "fuenteCalculo" text,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExplosionInsumoDetalle_explosionId_fkey" FOREIGN KEY ("explosionId") REFERENCES "ExplosionInsumosProyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExplosionInsumoDetalle_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "InsumoAPU"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PresupuestoProyectoCT" (
  "id" text PRIMARY KEY,
  "proyectoId" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "estado" "EstadoPresupuestoCT" NOT NULL DEFAULT 'BORRADOR',
  "nombre" text NOT NULL,
  "fechaCorte" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "porcentajeIndirectos" numeric(8,4) NOT NULL DEFAULT 0,
  "porcentajeFinanciamiento" numeric(8,4) NOT NULL DEFAULT 0,
  "porcentajeUtilidad" numeric(8,4) NOT NULL DEFAULT 0,
  "porcentajeCargosAdicionales" numeric(8,4) NOT NULL DEFAULT 0,
  "costoDirecto" numeric(18,6) NOT NULL DEFAULT 0,
  "indirectos" numeric(18,6) NOT NULL DEFAULT 0,
  "financiamiento" numeric(18,6) NOT NULL DEFAULT 0,
  "utilidad" numeric(18,6) NOT NULL DEFAULT 0,
  "cargosAdicionales" numeric(18,6) NOT NULL DEFAULT 0,
  "subtotal" numeric(18,6) NOT NULL DEFAULT 0,
  "impuestos" numeric(18,6) NOT NULL DEFAULT 0,
  "totalPresupuesto" numeric(18,6) NOT NULL DEFAULT 0,
  "observaciones" text,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" timestamp(3) NOT NULL,
  CONSTRAINT "PresupuestoProyectoCT_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "ProyectoGeneradores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PresupuestoProyectoCT_proyectoId_version_key" UNIQUE ("proyectoId","version")
);

CREATE TABLE "PresupuestoConceptoCT" (
  "id" text PRIMARY KEY,
  "presupuestoId" text NOT NULL,
  "conceptoId" text NOT NULL,
  "tarjetaAPUId" text,
  "partida" text,
  "subpartida" text,
  "clave" text,
  "descripcion" text NOT NULL,
  "unidad" text NOT NULL,
  "cantidad" numeric(18,6) NOT NULL DEFAULT 0,
  "precioUnitario" numeric(18,6) NOT NULL DEFAULT 0,
  "importe" numeric(18,6) NOT NULL DEFAULT 0,
  "orden" integer NOT NULL DEFAULT 0,
  "creadoEn" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" timestamp(3) NOT NULL,
  CONSTRAINT "PresupuestoConceptoCT_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "PresupuestoProyectoCT"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PresupuestoConceptoCT_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "ConceptoGeneradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PresupuestoConceptoCT_tarjetaAPUId_fkey" FOREIGN KEY ("tarjetaAPUId") REFERENCES "TarjetaPrecioUnitario"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ProyectoGeneradores_estado_idx" ON "ProyectoGeneradores"("estado");
CREATE INDEX "ProyectoGeneradores_creadoPorId_idx" ON "ProyectoGeneradores"("creadoPorId");
CREATE INDEX "ProyectoGeneradores_responsableId_idx" ON "ProyectoGeneradores"("responsableId");
CREATE INDEX "ProyectoGeneradores_fechaObjetivo_idx" ON "ProyectoGeneradores"("fechaObjetivo");
CREATE INDEX "DocumentoProyectoGeneradores_proyectoId_idx" ON "DocumentoProyectoGeneradores"("proyectoId");
CREATE INDEX "DocumentoProyectoGeneradores_clave_idx" ON "DocumentoProyectoGeneradores"("clave");
CREATE INDEX "DocumentoProyectoGeneradores_vigente_idx" ON "DocumentoProyectoGeneradores"("vigente");
CREATE INDEX "ConceptoGeneradores_proyectoId_idx" ON "ConceptoGeneradores"("proyectoId");
CREATE INDEX "ConceptoGeneradores_estado_idx" ON "ConceptoGeneradores"("estado");
CREATE INDEX "ConceptoGeneradores_partida_idx" ON "ConceptoGeneradores"("partida");
CREATE INDEX "ElementoConstructivoGeneradores_proyectoId_idx" ON "ElementoConstructivoGeneradores"("proyectoId");
CREATE INDEX "ElementoConstructivoGeneradores_documentoId_idx" ON "ElementoConstructivoGeneradores"("documentoId");
CREATE INDEX "ElementoConstructivoGeneradores_conceptoId_idx" ON "ElementoConstructivoGeneradores"("conceptoId");
CREATE INDEX "ElementoConstructivoGeneradores_tipo_idx" ON "ElementoConstructivoGeneradores"("tipo");
CREATE INDEX "MedicionElementoGeneradores_elementoId_idx" ON "MedicionElementoGeneradores"("elementoId");
CREATE INDEX "MedicionElementoGeneradores_magnitud_idx" ON "MedicionElementoGeneradores"("magnitud");
CREATE INDEX "GeneradorObra_proyectoId_idx" ON "GeneradorObra"("proyectoId");
CREATE INDEX "GeneradorObra_conceptoId_idx" ON "GeneradorObra"("conceptoId");
CREATE INDEX "GeneradorObra_estado_idx" ON "GeneradorObra"("estado");
CREATE INDEX "DetalleGeneradorObra_generadorId_idx" ON "DetalleGeneradorObra"("generadorId");
CREATE INDEX "DetalleGeneradorObra_documentoId_idx" ON "DetalleGeneradorObra"("documentoId");
CREATE INDEX "SolicitudInformacionGeneradores_proyectoId_idx" ON "SolicitudInformacionGeneradores"("proyectoId");
CREATE INDEX "SolicitudInformacionGeneradores_estado_idx" ON "SolicitudInformacionGeneradores"("estado");
CREATE INDEX "InconsistenciaProyectoGeneradores_proyectoId_idx" ON "InconsistenciaProyectoGeneradores"("proyectoId");
CREATE INDEX "InconsistenciaProyectoGeneradores_resuelta_idx" ON "InconsistenciaProyectoGeneradores"("resuelta");
CREATE INDEX "CambioProyectoGeneradores_proyectoId_idx" ON "CambioProyectoGeneradores"("proyectoId");
CREATE INDEX "CambioProyectoGeneradores_conceptoId_idx" ON "CambioProyectoGeneradores"("conceptoId");
CREATE INDEX "ReporteProyectoGeneradores_proyectoId_idx" ON "ReporteProyectoGeneradores"("proyectoId");
CREATE INDEX "ReporteProyectoGeneradores_tipo_idx" ON "ReporteProyectoGeneradores"("tipo");
CREATE INDEX "InsumoAPU_tipo_idx" ON "InsumoAPU"("tipo");
CREATE INDEX "InsumoAPU_activo_idx" ON "InsumoAPU"("activo");
CREATE INDEX "InsumoAPU_descripcion_idx" ON "InsumoAPU"("descripcion");
CREATE INDEX "TarjetaPrecioUnitario_proyectoId_idx" ON "TarjetaPrecioUnitario"("proyectoId");
CREATE INDEX "TarjetaPrecioUnitario_conceptoId_idx" ON "TarjetaPrecioUnitario"("conceptoId");
CREATE INDEX "TarjetaPrecioUnitario_estado_idx" ON "TarjetaPrecioUnitario"("estado");
CREATE INDEX "TarjetaAPUInsumo_tarjetaId_idx" ON "TarjetaAPUInsumo"("tarjetaId");
CREATE INDEX "TarjetaAPUInsumo_insumoId_idx" ON "TarjetaAPUInsumo"("insumoId");
CREATE INDEX "ExplosionInsumosProyecto_proyectoId_idx" ON "ExplosionInsumosProyecto"("proyectoId");
CREATE INDEX "ExplosionInsumosProyecto_estado_idx" ON "ExplosionInsumosProyecto"("estado");
CREATE INDEX "ExplosionInsumosProyecto_fechaCorte_idx" ON "ExplosionInsumosProyecto"("fechaCorte");
CREATE INDEX "ExplosionInsumoDetalle_explosionId_idx" ON "ExplosionInsumoDetalle"("explosionId");
CREATE INDEX "ExplosionInsumoDetalle_insumoId_idx" ON "ExplosionInsumoDetalle"("insumoId");
CREATE INDEX "ExplosionInsumoDetalle_tipo_idx" ON "ExplosionInsumoDetalle"("tipo");
CREATE INDEX "PresupuestoProyectoCT_proyectoId_idx" ON "PresupuestoProyectoCT"("proyectoId");
CREATE INDEX "PresupuestoProyectoCT_estado_idx" ON "PresupuestoProyectoCT"("estado");
CREATE INDEX "PresupuestoProyectoCT_fechaCorte_idx" ON "PresupuestoProyectoCT"("fechaCorte");
CREATE INDEX "PresupuestoConceptoCT_presupuestoId_idx" ON "PresupuestoConceptoCT"("presupuestoId");
CREATE INDEX "PresupuestoConceptoCT_conceptoId_idx" ON "PresupuestoConceptoCT"("conceptoId");
CREATE INDEX "PresupuestoConceptoCT_tarjetaAPUId_idx" ON "PresupuestoConceptoCT"("tarjetaAPUId");
CREATE INDEX "PresupuestoConceptoCT_partida_idx" ON "PresupuestoConceptoCT"("partida");

ALTER TABLE "ProyectoGeneradores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentoProyectoGeneradores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConceptoGeneradores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ElementoConstructivoGeneradores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MedicionElementoGeneradores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GeneradorObra" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DetalleGeneradorObra" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SolicitudInformacionGeneradores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InconsistenciaProyectoGeneradores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CambioProyectoGeneradores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReporteProyectoGeneradores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InsumoAPU" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TarjetaPrecioUnitario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TarjetaAPUInsumo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExplosionInsumosProyecto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExplosionInsumoDetalle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PresupuestoProyectoCT" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PresupuestoConceptoCT" ENABLE ROW LEVEL SECURITY;
