-- Seguridad de acceso:
-- 5 intentos fallidos consecutivos y bloqueo temporal de 15 minutos.

ALTER TABLE "public"."Usuario"
ADD COLUMN "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "bloqueadoHasta" TIMESTAMP(3),
ADD COLUMN "ultimoFalloLogin" TIMESTAMP(3);

CREATE INDEX "Usuario_bloqueadoHasta_idx"
ON "public"."Usuario"("bloqueadoHasta");