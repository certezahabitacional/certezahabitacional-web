-- Secuencia transaccional para folios de cotizacion incorporados al sistema.
-- Evita colisiones por concurrencia del esquema anterior count + 1.

CREATE SEQUENCE IF NOT EXISTS "Cotizacion_folio_seq" START 1;

SELECT setval(
  '"Cotizacion_folio_seq"',
  GREATEST(
    COALESCE(
      (
        SELECT MAX((regexp_match("folio", '([0-9]+)$'))[1]::BIGINT)
        FROM "Cotizacion"
        WHERE "folio" ~ '^CH-COT-[0-9]{4}-[0-9]+$'
      ),
      0
    ) + 1,
    1
  ),
  false
);
