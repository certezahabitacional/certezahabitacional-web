CREATE OR REPLACE FUNCTION certeza_v1_superar_devolucion_al_reenviar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."numeroInspeccion" = 1
     AND OLD."estado" = 'EN_PROCESO'
     AND NEW."estado" = 'REPORTE_PENDIENTE' THEN
    UPDATE "RevisionInspeccion"
    SET "estado" = 'SUPERADA'
    WHERE "inspeccionId" = NEW."id"
      AND "rol" = 'DIRECTOR'
      AND "decision" = 'DEVUELTO_INSPECTOR'
      AND "estado" = 'VIGENTE';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_certeza_v1_superar_devolucion_al_reenviar ON "Inspeccion";

CREATE TRIGGER trg_certeza_v1_superar_devolucion_al_reenviar
AFTER UPDATE OF "estado" ON "Inspeccion"
FOR EACH ROW
EXECUTE FUNCTION certeza_v1_superar_devolucion_al_reenviar();
