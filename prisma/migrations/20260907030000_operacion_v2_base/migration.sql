
-- Plantillas configurables, roles opcionales por inspeccion y cambio obligatorio de password.

CREATE TABLE IF NOT EXISTS "PlantillaInspeccion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipoServicio" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "requiereGerenteZona" BOOLEAN NOT NULL DEFAULT false,
    "requiereCoordinador" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlantillaInspeccion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlantillaInspeccion_codigo_key"
  ON "PlantillaInspeccion"("codigo");

CREATE INDEX IF NOT EXISTS "PlantillaInspeccion_activa_idx"
  ON "PlantillaInspeccion"("activa");

CREATE INDEX IF NOT EXISTS "PlantillaInspeccion_tipoServicio_idx"
  ON "PlantillaInspeccion"("tipoServicio");

ALTER TABLE "Usuario"
  ADD COLUMN IF NOT EXISTS "requiereCambioPassword"
  BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Inspeccion"
  ADD COLUMN IF NOT EXISTS "plantillaId" TEXT,
  ADD COLUMN IF NOT EXISTS "requiereGerenteZona" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "requiereCoordinador" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Inspeccion_plantillaId_idx"
  ON "Inspeccion"("plantillaId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Inspeccion_plantillaId_fkey'
  ) THEN
    ALTER TABLE "Inspeccion"
      ADD CONSTRAINT "Inspeccion_plantillaId_fkey"
      FOREIGN KEY ("plantillaId")
      REFERENCES "PlantillaInspeccion"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

-- Zonas iniciales. Se conservan registros existentes por codigo.
INSERT INTO "Zona" (
  "id",
  "nombre",
  "codigo",
  "ciudad",
  "estado",
  "zonaHoraria",
  "activa",
  "creadoEn",
  "actualizadoEn"
) VALUES
(
  'zona_cj_v2',
  'Ciudad Juárez',
  'CDJ',
  'Ciudad Juárez',
  'Chihuahua',
  'America/Ciudad_Juarez',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'zona_gdl_v2',
  'Guadalajara',
  'GDL',
  'Guadalajara',
  'Jalisco',
  'America/Mexico_City',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'zona_tij_v2',
  'Tijuana',
  'TIJ',
  'Tijuana',
  'Baja California',
  'America/Tijuana',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'zona_hmo_v2',
  'Hermosillo',
  'HMO',
  'Hermosillo',
  'Sonora',
  'America/Hermosillo',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "ciudad" = EXCLUDED."ciudad",
  "estado" = EXCLUDED."estado",
  "zonaHoraria" = EXCLUDED."zonaHoraria",
  "activa" = true,
  "actualizadoEn" = CURRENT_TIMESTAMP;

-- Plantillas base equivalentes a los tipos actuales.
-- Por seguridad operan sin Gerencia/Coordinacion obligatorias.
INSERT INTO "PlantillaInspeccion" (
  "id",
  "nombre",
  "codigo",
  "descripcion",
  "tipoServicio",
  "activa",
  "requiereGerenteZona",
  "requiereCoordinador",
  "creadoEn",
  "actualizadoEn"
) VALUES
(
  'plt_entrega_v2',
  'Recepción de vivienda nueva',
  'ENTREGA',
  'Inspección para recepción o entrega de vivienda nueva.',
  'ENTREGA',
  true,
  false,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'plt_garantia_v2',
  'Inspección de garantía',
  'GARANTIA',
  'Inspección durante el periodo de garantía de la vivienda.',
  'GARANTIA',
  true,
  false,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'plt_usada_v2',
  'Inspección para compra de vivienda usada',
  'USADA',
  'Inspección técnica previa a una decisión de compra.',
  'USADA',
  true,
  false,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'plt_preventiva_v2',
  'Inspección preventiva',
  'PREVENTIVA',
  'Revisión preventiva del estado de la vivienda.',
  'PREVENTIVA',
  true,
  false,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  'plt_dictamen_v2',
  'Dictamen técnico',
  'DICTAMEN',
  'Inspección orientada a la emisión de dictamen técnico.',
  'DICTAMEN',
  true,
  false,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("codigo") DO NOTHING;
