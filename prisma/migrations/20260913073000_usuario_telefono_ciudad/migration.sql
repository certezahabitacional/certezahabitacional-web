-- Fase 2: expediente homogéneo para usuarios internos.
-- La migración es aditiva y no modifica datos existentes.
ALTER TABLE "Usuario"
ADD COLUMN "telefono" TEXT,
ADD COLUMN "ciudad" TEXT;
