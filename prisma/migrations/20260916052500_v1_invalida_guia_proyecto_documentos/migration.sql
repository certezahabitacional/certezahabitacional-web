CREATE OR REPLACE FUNCTION invalidar_guia_proyecto_v1_por_documento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  inspeccion_id text;
  numero_inspeccion integer;
BEGIN
  inspeccion_id := COALESCE(NEW."inspeccionId", OLD."inspeccionId");

  SELECT i."numeroInspeccion" INTO numero_inspeccion
  FROM public."Inspeccion" i
  WHERE i."id" = inspeccion_id;

  IF numero_inspeccion = 1 THEN
    DELETE FROM public."GuiaInspeccionItem"
    WHERE "inspeccionId" = inspeccion_id
      AND "origen" = 'PROYECTO';

    UPDATE public."InspeccionControlV2"
    SET "proyectoConfirmado" = false,
        "actualizadoEn" = NOW()
    WHERE "inspeccionId" = inspeccion_id
      AND "proyectoConfirmado" = true;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidar_guia_proyecto_v1_documento ON "DocumentoProyectoInspeccion";

CREATE TRIGGER trg_invalidar_guia_proyecto_v1_documento
AFTER INSERT OR UPDATE OF "estadoAnalisis", "datosExtraidos", "ruta", "tipo" OR DELETE
ON "DocumentoProyectoInspeccion"
FOR EACH ROW
EXECUTE FUNCTION invalidar_guia_proyecto_v1_por_documento();
