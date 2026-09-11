-- Fase 1: folio unico e inmutable para Cliente.
-- La columna inicia nullable para permitir una migracion segura de datos existentes.
ALTER TABLE "Cliente" ADD COLUMN "folio" TEXT;

CREATE UNIQUE INDEX "Cliente_folio_key" ON "Cliente"("folio");
CREATE INDEX "Cliente_folio_idx" ON "Cliente"("folio");

-- Asigna folio a clientes historicos existentes de forma deterministica.
-- El sufijo se deriva del orden de creacion y evita duplicados.
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

ALTER TABLE "Cliente" ALTER COLUMN "folio" SET NOT NULL;
