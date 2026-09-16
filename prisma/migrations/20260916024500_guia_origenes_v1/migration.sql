ALTER TABLE public."GuiaInspeccionItem"
DROP CONSTRAINT IF EXISTS "GuiaInspeccionItem_origen_check";

ALTER TABLE public."GuiaInspeccionItem"
ADD CONSTRAINT "GuiaInspeccionItem_origen_check"
CHECK ("origen" = ANY (ARRAY[
  'PROYECTO'::text,
  'COTIZACION'::text,
  'ESTANDAR'::text,
  'MANUAL'::text,
  'BIBLIOTECA_CERTEZA'::text,
  'INSPECTOR'::text
]));
