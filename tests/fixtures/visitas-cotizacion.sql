-- Esquema para pruebas aisladas. NO ejecutar en produccion.
-- La migracion de despliegue debe generarse con Supabase CLI y aprobarse por separado.
CREATE TABLE "CotizacionVisita" (
  "id" TEXT PRIMARY KEY,
  "cotizacionOrigenId" TEXT NOT NULL REFERENCES "Cotizacion"("id") ON DELETE RESTRICT,
  "cotizacionVisitaId" TEXT NOT NULL UNIQUE REFERENCES "Cotizacion"("id") ON DELETE RESTRICT,
  "inspeccionAnteriorId" TEXT NOT NULL UNIQUE REFERENCES "Inspeccion"("id") ON DELETE RESTRICT,
  "numeroVisita" INTEGER NOT NULL CHECK ("numeroVisita" >= 2),
  "creadaPorId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE RESTRICT,
  "motivo" TEXT NOT NULL,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("cotizacionOrigenId", "numeroVisita"),
  CHECK ("cotizacionOrigenId" <> "cotizacionVisitaId")
);
ALTER TABLE "CotizacionVisita" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "CotizacionVisita" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "CotizacionVisita" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "CotizacionVisita" FROM authenticated;
  END IF;
END $$;

CREATE FUNCTION public.validar_inspeccion_visita_contratada() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE vinculo record;
BEGIN
  -- No permitir que una accion heredada elimine la referencia financiera de V2.
  IF TG_OP = 'UPDATE' THEN
    IF OLD."cotizacionId" IS DISTINCT FROM NEW."cotizacionId" AND EXISTS (
      SELECT 1 FROM public."CotizacionVisita" WHERE "cotizacionVisitaId" = OLD."cotizacionId"
    ) THEN
      RAISE EXCEPTION 'No se puede desvincular la inspeccion de su visita contratada' USING ERRCODE = '23514';
    END IF;
  END IF;
  SELECT v."inspeccionAnteriorId", v."numeroVisita", c."clienteId", c."inmuebleId", c."zonaId"
    INTO vinculo FROM public."CotizacionVisita" v
    JOIN public."Cotizacion" c ON c."id" = v."cotizacionOrigenId"
    WHERE v."cotizacionVisitaId" = NEW."cotizacionId";
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NEW."inspeccionAnteriorId" IS DISTINCT FROM vinculo."inspeccionAnteriorId"
     OR NEW."numeroInspeccion" IS DISTINCT FROM vinculo."numeroVisita"
     OR NEW."clienteId" IS DISTINCT FROM vinculo."clienteId"
     OR NEW."inmuebleId" IS DISTINCT FROM vinculo."inmuebleId"
     OR NEW."zonaId" IS DISTINCT FROM vinculo."zonaId" THEN
    RAISE EXCEPTION 'La inspeccion no coincide con la visita contratada' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validar_inspeccion_visita_contratada() FROM PUBLIC;
CREATE TRIGGER inspeccion_visita_contratada
BEFORE INSERT OR UPDATE OF "cotizacionId", "inspeccionAnteriorId", "numeroInspeccion", "clienteId", "inmuebleId", "zonaId"
ON "Inspeccion" FOR EACH ROW EXECUTE FUNCTION public.validar_inspeccion_visita_contratada();
