CREATE OR REPLACE FUNCTION enlazar_guia_v1_con_area_existente()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  numero_inspeccion integer;
  area_id uuid;
BEGIN
  IF NEW."areaId" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT i."numeroInspeccion" INTO numero_inspeccion
  FROM public."Inspeccion" i
  WHERE i."id" = NEW."inspeccionId";

  IF numero_inspeccion <> 1 THEN
    RETURN NEW;
  END IF;

  SELECT a."id" INTO area_id
  FROM public."AreaInspeccion" a
  WHERE a."inspeccionId" = NEW."inspeccionId"
    AND regexp_replace(upper(unaccent(btrim(a."nombre"))), '[^A-Z0-9]+', '_', 'g') =
        regexp_replace(upper(unaccent(btrim(NEW."area"))), '[^A-Z0-9]+', '_', 'g')
  ORDER BY a."orden", a."id"
  LIMIT 1;

  IF area_id IS NOT NULL THEN
    UPDATE public."GuiaInspeccionItem"
    SET "areaId" = area_id,
        "actualizadoEn" = NOW()
    WHERE "id" = NEW."id" AND "areaId" IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enlazar_area_v1_con_guia_existente()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  numero_inspeccion integer;
BEGIN
  SELECT i."numeroInspeccion" INTO numero_inspeccion
  FROM public."Inspeccion" i
  WHERE i."id" = NEW."inspeccionId";

  IF numero_inspeccion = 1 THEN
    UPDATE public."GuiaInspeccionItem" g
    SET "areaId" = NEW."id",
        "actualizadoEn" = NOW()
    WHERE g."inspeccionId" = NEW."inspeccionId"
      AND g."areaId" IS NULL
      AND regexp_replace(upper(unaccent(btrim(g."area"))), '[^A-Z0-9]+', '_', 'g') =
          regexp_replace(upper(unaccent(btrim(NEW."nombre"))), '[^A-Z0-9]+', '_', 'g');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enlazar_guia_v1_area ON "GuiaInspeccionItem";
DROP TRIGGER IF EXISTS trg_enlazar_area_v1_guia ON "AreaInspeccion";

CREATE TRIGGER trg_enlazar_guia_v1_area
AFTER INSERT OR UPDATE OF "area", "inspeccionId" ON "GuiaInspeccionItem"
FOR EACH ROW
EXECUTE FUNCTION enlazar_guia_v1_con_area_existente();

CREATE TRIGGER trg_enlazar_area_v1_guia
AFTER INSERT OR UPDATE OF "nombre", "inspeccionId" ON "AreaInspeccion"
FOR EACH ROW
EXECUTE FUNCTION enlazar_area_v1_con_guia_existente();

UPDATE public."GuiaInspeccionItem" g
SET "areaId" = a."id",
    "actualizadoEn" = NOW()
FROM public."AreaInspeccion" a
JOIN public."Inspeccion" i ON i."id" = a."inspeccionId" AND i."numeroInspeccion" = 1
WHERE g."inspeccionId" = a."inspeccionId"
  AND g."areaId" IS NULL
  AND regexp_replace(upper(unaccent(btrim(g."area"))), '[^A-Z0-9]+', '_', 'g') =
      regexp_replace(upper(unaccent(btrim(a."nombre"))), '[^A-Z0-9]+', '_', 'g');
