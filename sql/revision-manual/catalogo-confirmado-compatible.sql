-- Aplicacion manual controlada. No modifica inspecciones ni ejecuta recuperaciones.
CREATE OR REPLACE FUNCTION public.validar_cierre_catalogo_confirmado(p_inspeccion text)
RETURNS void LANGUAGE plpgsql
SET search_path TO 'public','pg_temp'
AS $validated_catalog$
DECLARE
  plan jsonb; p jsonb; s jsonb; c jsonb; n integer; cod text; aid uuid;
  revisada text; v_resultado text; conceptos_encontrados integer; total integer; ids uuid[] := '{}';
BEGIN
  SELECT "partidas" INTO plan FROM public."PlanPrevioInspeccion"
  WHERE "inspeccionId"=p_inspeccion AND "confirmadoEn" IS NOT NULL;
  IF plan IS NULL OR jsonb_typeof(plan)<>'array' OR jsonb_array_length(plan)=0 THEN
    RAISE EXCEPTION 'Falta un plan confirmado valido.' USING ERRCODE='23514';
  END IF;
  FOR p IN SELECT value FROM jsonb_array_elements(plan) LOOP
    IF jsonb_typeof(p->'subpartidas') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'subpartidas')=0 THEN
      RAISE EXCEPTION 'Partida sin subpartidas.' USING ERRCODE='23514';
    END IF;
    n:=0;
    FOR s IN SELECT value FROM jsonb_array_elements(p->'subpartidas') LOOP
      n:=n+1;
      cod:='PLAN_'||lpad((p->>'orden'),2,'0')||'_'||lpad(n::text,2,'0');
      SELECT count(*) INTO total FROM public."AreaInspeccion"
      WHERE "inspeccionId"=p_inspeccion AND "origen"='PLAN_PREVIO' AND "codigo"=cod AND "nombre"=s->>'nombre';
      IF total<>1 THEN RAISE EXCEPTION 'Subpartida faltante o ambigua: %',s->>'nombre' USING ERRCODE='23514'; END IF;
      SELECT "id","estado","resultado" INTO aid,revisada,v_resultado FROM public."AreaInspeccion"
      WHERE "inspeccionId"=p_inspeccion AND "origen"='PLAN_PREVIO' AND "codigo"=cod AND "nombre"=s->>'nombre';
      IF aid=ANY(ids) THEN RAISE EXCEPTION 'Subpartida repetida en el plan.' USING ERRCODE='23514'; END IF;
      ids:=array_append(ids,aid);
      IF revisada IS DISTINCT FROM 'REVISADA' OR v_resultado IS NULL OR v_resultado NOT IN ('SIN_HALLAZGOS','CON_HALLAZGOS','NO_APLICA') THEN
        RAISE EXCEPTION 'Falta el cierre explicito de %',s->>'nombre' USING ERRCODE='23514';
      END IF;
      IF jsonb_typeof(s->'conceptos') IS DISTINCT FROM 'array' OR jsonb_array_length(s->'conceptos')=0 THEN
        RAISE EXCEPTION 'Subpartida sin conceptos.' USING ERRCODE='23514';
      END IF;
      FOR c IN SELECT value FROM jsonb_array_elements(s->'conceptos') LOOP
        SELECT count(*) INTO conceptos_encontrados FROM public."GuiaInspeccionItem"
        WHERE "inspeccionId"=p_inspeccion AND "areaId"=aid AND "concepto"=c->>'nombre';
        IF conceptos_encontrados<>1 THEN RAISE EXCEPTION 'Concepto faltante o repetido: %',c->>'nombre' USING ERRCODE='23514'; END IF;
      END LOOP;
      IF EXISTS (SELECT 1 FROM public."GuiaInspeccionItem" g WHERE g."areaId"=aid AND
        (g."inspeccionId"<>p_inspeccion OR g."estadoV3" NOT IN ('REVISADO','CON_HALLAZGO','NO_APLICA') OR
         (g."estadoV3"='NO_APLICA' AND nullif(btrim(g."motivoNoAplica"),'') IS NULL))) THEN
        RAISE EXCEPTION 'Conceptos pendientes o No aplica sin motivo en %',s->>'nombre' USING ERRCODE='23514';
      END IF;
      IF EXISTS (SELECT 1 FROM public."GuiaInspeccionItem" g WHERE g."areaId"=aid AND g."estadoV3" IN ('REVISADO','CON_HALLAZGO') AND
        (nullif(btrim(g."observacion"),'') IS NULL OR
         (SELECT count(*) FROM public."FotografiaArea" fa JOIN public."Fotografia" f ON f."id"=fa."fotografiaId"
          WHERE fa."guiaItemId"=g."id" AND f."inspeccionId"=p_inspeccion) NOT BETWEEN 1 AND 4 OR
         (g."requiereMedicion" AND (nullif(btrim(g."valorMedido"),'') IS NULL OR nullif(btrim(g."unidadMedida"),'') IS NULL)))) THEN
        RAISE EXCEPTION 'Resultado, lectura o evidencia incompleta en %',s->>'nombre' USING ERRCODE='23514';
      END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public."AreaInspeccion" WHERE "inspeccionId"=p_inspeccion AND "origen"='PLAN_PREVIO' AND NOT("id"=ANY(ids))) OR
     EXISTS (SELECT 1 FROM public."GuiaInspeccionItem" WHERE "inspeccionId"=p_inspeccion AND "origenV3"='PLAN_PREVIO' AND ("areaId" IS NULL OR NOT("areaId"=ANY(ids)))) THEN
    RAISE EXCEPTION 'Existen registros sin vincular al plan.' USING ERRCODE='23514';
  END IF;
  SELECT count(*) INTO total FROM public."FotografiaArea" fa JOIN public."AreaInspeccion" a ON a."id"=fa."areaId"
  WHERE a."inspeccionId"=p_inspeccion AND a."codigo" IN ('FACHADA_PRINCIPAL','FACHADA_FRONTAL') AND fa."candidataPortada";
  IF total<>1 THEN RAISE EXCEPTION 'Debe existir una sola portada seleccionada.' USING ERRCODE='23514'; END IF;
  IF EXISTS (SELECT 1 FROM public."Hallazgo" h WHERE h."inspeccionId"=p_inspeccion AND
     (nullif(btrim(h."descripcion"),'') IS NULL OR
      (SELECT count(*) FROM public."Fotografia" f WHERE f."hallazgoId"=h."id" AND f."inspeccionId"=p_inspeccion) NOT BETWEEN 1 AND 4)) THEN
    RAISE EXCEPTION 'Hallazgos sin descripcion o evidencia suficiente.' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public."OperacionCampoSync" WHERE "inspeccionId"=p_inspeccion AND "estado"<>'PROCESADA') THEN
    RAISE EXCEPTION 'Hay operaciones pendientes de sincronizar.' USING ERRCODE='23514';
  END IF;
END;
$validated_catalog$;
DO $preserve_legacy$
DECLARE original text; agregado text;
BEGIN
  original:=pg_get_functiondef('public.validar_evidencia_minima_cierre_inspeccion()'::regprocedure);
  IF position('CERTEZA_PLAN_CONFIRMADO_V1' in original)>0 THEN RETURN; END IF;
  IF original NOT LIKE '%RETURNS trigger%' OR original NOT LIKE '%REPORTE_PENDIENTE%' OR original NOT LIKE '%RETURN new%' THEN
    RAISE EXCEPTION 'La funcion anterior difiere de la revisada. Detener y revisar su definicion completa.';
  END IF;
  agregado:=$branch$BEGIN
  -- CERTEZA_PLAN_CONFIRMADO_V1: conserva intacto el recorrido historico.
  IF TG_OP='UPDATE' AND NEW."numeroInspeccion"=1 AND NEW."estado"='REPORTE_PENDIENTE'
     AND OLD."estado" IS DISTINCT FROM NEW."estado"
     AND EXISTS (SELECT 1 FROM public."PlanPrevioInspeccion" WHERE "inspeccionId"=NEW."id" AND "confirmadoEn" IS NOT NULL) THEN
    PERFORM public.validar_cierre_catalogo_confirmado(NEW."id");
    RETURN NEW;
  END IF;
$branch$;
  EXECUTE regexp_replace(original,'\mBEGIN\M',agregado,'i');
END;
$preserve_legacy$;
ALTER TABLE public."PlanPrevioInspeccion" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."PlanPrevioInspeccion" FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.validar_cierre_catalogo_confirmado(text) FROM PUBLIC;
