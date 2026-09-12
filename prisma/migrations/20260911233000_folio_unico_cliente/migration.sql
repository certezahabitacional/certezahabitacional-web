-- Fase 1: folio unico e inmutable para Cliente.
-- Se mantiene compatible con todos los puntos actuales que crean Cliente:
-- la base genera el folio aunque el codigo que origina el alta aun no lo envie.

CREATE SEQUENCE IF NOT EXISTS "Cliente_folio_seq" START 1;

ALTER TABLE "Cliente" ADD COLUMN "folio" TEXT;

-- Clientes historicos: folio deterministico y unico.
WITH ordenados AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "creadoEn", "id") AS consecutivo,
    EXTRACT(YEAR FROM "creadoEn")::INT AS anio
  FROM "Cliente"
  WHERE "folio" IS NULL
)
UPDATE "Cliente" c
SET "folio" = 'CH-CLI-' || o.anio::TEXT || '-' || LPAD(o.consecutivo::TEXT, 6, '0')
FROM ordenados o
WHERE c."id" = o."id";

-- Coloca la secuencia por encima de los folios historicos para evitar colisiones.
SELECT setval(
  '"Cliente_folio_seq"',
  GREATEST(
    COALESCE(
      (
        SELECT MAX((regexp_match("folio", '([0-9]+)$'))[1]::BIGINT)
        FROM "Cliente"
        WHERE "folio" IS NOT NULL
      ),
      0
    ) + 1,
    1
  ),
  false
);

ALTER TABLE "Cliente"
  ALTER COLUMN "folio" SET DEFAULT (
    'CH-CLI-' || EXTRACT(YEAR FROM CURRENT_DATE)::INT::TEXT || '-' ||
    LPAD(nextval('"Cliente_folio_seq"')::TEXT, 6, '0')
  );

ALTER TABLE "Cliente" ALTER COLUMN "folio" SET NOT NULL;

CREATE UNIQUE INDEX "Cliente_folio_key" ON "Cliente"("folio");
CREATE INDEX "Cliente_folio_idx" ON "Cliente"("folio");
