-- Invariante operativa de evidencia Certeza Habitacional.
-- Antes de pasar una inspeccion de EN_PROCESO a REPORTE_PENDIENTE:
--   1) debe existir al menos un hallazgo;
--   2) cada hallazgo debe tener al menos 4 fotografias asociadas.
--
-- La validacion se ejecuta en base de datos para evitar que una ruta historica,
-- accion directa o futura pantalla pueda omitir accidentalmente esta regla.
-- La migracion se prepara para preproduccion; no se aplica automaticamente.

CREATE OR REPLACE FUNCTION "validar_evidencia_minima_cierre_inspeccion"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  total_hallazgos INTEGER;
  hallazgos_incompletos INTEGER;
BEGIN
  IF NEW."estado" = 'REPORTE_PENDIENTE'
     AND OLD."estado" IS DISTINCT FROM NEW."estado" THEN

    SELECT COUNT(*)
      INTO total_hallazgos
    FROM "Hallazgo" h
    WHERE h."inspeccionId" = NEW."id";

    IF total_hallazgos = 0 THEN
      RAISE EXCEPTION USING
        MESSAGE = 'No se puede finalizar la captura: la inspeccion no tiene hallazgos registrados.',
        ERRCODE = '23514';
    END IF;

    SELECT COUNT(*)
      INTO hallazgos_incompletos
    FROM "Hallazgo" h
    WHERE h."inspeccionId" = NEW."id"
      AND (
        SELECT COUNT(*)
        FROM "Fotografia" f
        WHERE f."hallazgoId" = h."id"
          AND f."inspeccionId" = NEW."id"
      ) < 4;

    IF hallazgos_incompletos > 0 THEN
      RAISE EXCEPTION USING
        MESSAGE = format(
          'No se puede finalizar la captura: %s hallazgo(s) tienen menos de 4 evidencias fotograficas.',
          hallazgos_incompletos
        ),
        ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_validar_evidencia_minima_cierre_inspeccion" ON "Inspeccion";

CREATE TRIGGER "trg_validar_evidencia_minima_cierre_inspeccion"
BEFORE UPDATE OF "estado" ON "Inspeccion"
FOR EACH ROW
EXECUTE FUNCTION "validar_evidencia_minima_cierre_inspeccion"();
