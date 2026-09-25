CREATE TABLE IF NOT EXISTS "PlanInspeccionV1" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "inspeccionId" text NOT NULL UNIQUE REFERENCES "Inspeccion"("id") ON DELETE CASCADE,
  "perfil" text NOT NULL CHECK ("perfil" IN ('NUEVA','USADA')),
  "estado" text NOT NULL DEFAULT 'BORRADOR' CHECK ("estado" IN ('BORRADOR','CONFIRMADO')),
  "seleccion" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "estimadoMinutos" integer,
  "confirmadoPorId" text REFERENCES "Usuario"("id") ON DELETE SET NULL,
  "confirmadoEn" timestamptz,
  "creadoEn" timestamptz NOT NULL DEFAULT now(),
  "actualizadoEn" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "PlanInspeccionV1" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "PlanInspeccionV1_estado_idx"
  ON "PlanInspeccionV1" ("estado");

CREATE INDEX IF NOT EXISTS "PlanInspeccionV1_confirmadoEn_idx"
  ON "PlanInspeccionV1" ("confirmadoEn");
