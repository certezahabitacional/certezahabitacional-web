CREATE OR REPLACE FUNCTION certeza_v1_bloquear_mutacion_finalizada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  inspeccion_id text;
  numero_inspeccion integer;
  estado_inspeccion text;
  correccion_documental boolean;
BEGIN
  inspeccion_id := COALESCE(NEW."inspeccionId", OLD."inspeccionId");

  SELECT i."numeroInspeccion", i."estado"::text
  INTO numero_inspeccion, estado_inspeccion
  FROM public."Inspeccion" i
  WHERE i."id" = inspeccion_id;

  SELECT EXISTS(
    SELECT 1
    FROM public."RevisionInspeccion" r
    WHERE r."inspeccionId" = inspeccion_id
      AND r."rol" = 'DIRECTOR'
      AND r."decision" = 'DEVUELTO_INSPECTOR'
      AND r."estado" = 'VIGENTE'
      AND r."comentario" LIKE '[CORRECCIÓN DOCUMENTAL]%'
  ) INTO correccion_documental;

  IF numero_inspeccion = 1 AND (estado_inspeccion = 'FINALIZADA' OR correccion_documental) THEN
    RAISE EXCEPTION USING
      MESSAGE = CASE
        WHEN estado_inspeccion = 'FINALIZADA'
          THEN 'V1 finalizada: el expediente técnico es inmutable. Reabre formalmente la inspección antes de modificarlo.'
        ELSE 'V1 en corrección documental: no se permite modificar evidencia, hallazgos, resultados ni datos técnicos. Usa únicamente el editor editorial del reporte.'
      END,
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
  inspeccion_id text;
  numero_inspeccion integer;
  estado_inspeccion text;
  correccion_documental boolean;
BEGIN
  area_id := COALESCE(NEW."areaId", OLD."areaId");

  SELECT i."id", i."numeroInspeccion", i."estado"::text
  INTO inspeccion_id, numero_inspeccion, estado_inspeccion
  FROM public."AreaInspeccion" a
  JOIN public."Inspeccion" i ON i."id" = a."inspeccionId"
  WHERE a."id" = area_id;

  SELECT EXISTS(
    SELECT 1
    FROM public."RevisionInspeccion" r
    WHERE r."inspeccionId" = inspeccion_id
      AND r."rol" = 'DIRECTOR'
      AND r."decision" = 'DEVUELTO_INSPECTOR'
      AND r."estado" = 'VIGENTE'
      AND r."comentario" LIKE '[CORRECCIÓN DOCUMENTAL]%'
  ) INTO correccion_documental;

  IF numero_inspeccion = 1 AND (estado_inspeccion = 'FINALIZADA' OR correccion_documental) THEN
    RAISE EXCEPTION USING
      MESSAGE = CASE
        WHEN estado_inspeccion = 'FINALIZADA'
          THEN 'V1 finalizada: las fotografías por área son inmutables. Reabre formalmente la inspección antes de modificarlas.'
        ELSE 'V1 en corrección documental: no se permite alterar las fotografías ni su evidencia técnica. Usa únicamente el editor editorial del reporte.'
      END,
      ERRCODE = '23514';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
