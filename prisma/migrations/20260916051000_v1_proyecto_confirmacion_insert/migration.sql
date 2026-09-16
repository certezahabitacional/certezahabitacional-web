CREATE OR REPLACE FUNCTION validar_confirmacion_proyecto_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  numero_inspeccion integer;
  documentos_total integer;
  documentos_incompletos integer;
  puntos_proyecto integer;
  debe_validar boolean;
BEGIN
  debe_validar := NEW."proyectoConfirmado" = true
    AND (TG_OP = 'INSERT' OR COALESCE(OLD."proyectoConfirmado", false) = false);

  IF debe_validar THEN
    SELECT i."numeroInspeccion" INTO numero_inspeccion
    FROM public."Inspeccion" i
    WHERE i."id" = NEW."inspeccionId";

    IF numero_inspeccion = 1 THEN
      SELECT COUNT(*)::int,
             COUNT(*) FILTER (WHERE "estadoAnalisis" <> 'COMPLETADO' OR "datosExtraidos" IS NULL)::int
      INTO documentos_total, documentos_incompletos
      FROM public."DocumentoProyectoInspeccion"
      WHERE "inspeccionId" = NEW."inspeccionId";

      IF documentos_total > 0 THEN
        IF documentos_incompletos > 0 THEN
          RAISE EXCEPTION USING
            MESSAGE = format('No se puede confirmar el proyecto V1: %s documento(s) siguen sin análisis completo.', documentos_incompletos),
            ERRCODE = '23514';
        END IF;

        SELECT COUNT(*)::int INTO puntos_proyecto
        FROM public."GuiaInspeccionItem"
        WHERE "inspeccionId" = NEW."inspeccionId" AND "origen" = 'PROYECTO';

        IF puntos_proyecto = 0 THEN
          RAISE EXCEPTION USING
            MESSAGE = 'No se puede confirmar el proyecto V1: genera primero la guía técnica desde los PDF analizados.',
            ERRCODE = '23514';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_confirmacion_proyecto_v1 ON "InspeccionControlV2";
DROP TRIGGER IF EXISTS trg_validar_confirmacion_proyecto_v1_insert ON "InspeccionControlV2";

CREATE TRIGGER trg_validar_confirmacion_proyecto_v1
BEFORE UPDATE OF "proyectoConfirmado" ON "InspeccionControlV2"
FOR EACH ROW
EXECUTE FUNCTION validar_confirmacion_proyecto_v1();

CREATE TRIGGER trg_validar_confirmacion_proyecto_v1_insert
BEFORE INSERT ON "InspeccionControlV2"
FOR EACH ROW
EXECUTE FUNCTION validar_confirmacion_proyecto_v1();
