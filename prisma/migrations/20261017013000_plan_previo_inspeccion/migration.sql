-- Plan independiente de auditoria previa; no altera guias ni evidencias existentes.
CREATE TABLE IF NOT EXISTS "PlanPrevioInspeccion" (
  "inspeccionId" TEXT PRIMARY KEY REFERENCES "Inspeccion"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL DEFAULT 1,
  "partidas" JSONB NOT NULL,
  "confirmadoEn" TIMESTAMP(3),
  "confirmadoPorId" TEXT REFERENCES "Usuario"("id") ON DELETE SET NULL,
  "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoPorId" TEXT REFERENCES "Usuario"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "PlanPrevioInspeccion_confirmadoEn_idx" ON "PlanPrevioInspeccion"("confirmadoEn");
