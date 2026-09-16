CREATE OR REPLACE FUNCTION certeza_v1_bloquear_mutacion_finalizada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  inspeccion_id text;
  numero_inspeccion integer;
  estado_inspeccion text;
BEGIN
  inspeccion_id := COALESCE(NEW."inspeccionId", OLD."inspeccionId");

  SELECT i."numeroInspeccion", i."estado"::text
  INTO numero_inspeccion, estado_inspeccion
  FROM public."Inspeccion" i
  WHERE i."id" = inspeccion_id;

  IF numero_inspeccion = 1 AND estado_inspeccion = 'FINALIZADA' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'V1 finalizada: el expediente técnico es inmutable. Reabre formalmente la inspección antes de modificarlo.',
      ERRCODE = '23514';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION certeza_v1_bloquear_mutacion_fotografia_area_finalizada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  area_id uuid;
  numero_inspeccion integer;
  estado_inspeccion text;
BEGIN
  area_id := COALESCE(NEW."areaId", OLD."areaId");

  SELECT i."numeroInspeccion", i."estado"::text
  INTO numero_inspeccion, estado_inspeccion
  FROM public."AreaInspeccion" a
  JOIN public."Inspeccion" i ON i."id" = a."inspeccionId"
  WHERE a."id" = area_id;

  IF numero_inspeccion = 1 AND estado_inspeccion = 'FINALIZADA' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'V1 finalizada: las fotografías por área son inmutables. Reabre formalmente la inspección antes de modificarlas.',
      ERRCODE = '23514';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'AreaInspeccion',
    'GuiaInspeccionItem',
    'ProtocoloInspeccionPaso',
    'Hallazgo',
    'Fotografia',
    'Firma',
    'DocumentoProyectoInspeccion',
    'InspeccionControlV2'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_v1_bloquea_mutacion_finalizada ON %I', tabla);
    EXECUTE format(
      'CREATE TRIGGER trg_v1_bloquea_mutacion_finalizada BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION certeza_v1_bloquear_mutacion_finalizada()',
      tabla
    );
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS trg_v1_bloquea_mutacion_fotografia_area_finalizada ON "FotografiaArea";
CREATE TRIGGER trg_v1_bloquea_mutacion_fotografia_area_finalizada
BEFORE INSERT OR UPDATE OR DELETE ON "FotografiaArea"
FOR EACH ROW
EXECUTE FUNCTION certeza_v1_bloquear_mutacion_fotografia_area_finalizada();
