-- Alinea la validacion de cierre V1 con el flujo operativo vigente:
-- la fachada frontal requiere al menos una fotografia y exactamente una candidata a portada.
CREATE OR REPLACE FUNCTION public.validar_evidencia_minima_cierre_inspeccion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  usa_metodo boolean;
  proyecto_confirmado boolean;
  areas_confirmadas boolean;
  areas_obligatorias integer;
  areas_incompletas integer;
  pasos_incompletos integer;
  hallazgos_incompletos integer;
  fotos_fachada integer;
  portadas_fachada integer;
BEGIN
  IF new."estado" = 'REPORTE_PENDIENTE' AND old."estado" IS DISTINCT FROM new."estado" THEN
    SELECT EXISTS(
      SELECT 1 FROM public."InspeccionControlV2" c WHERE c."inspeccionId" = new."id"
    ) INTO usa_metodo;

    IF usa_metodo AND new."numeroInspeccion" = 1 THEN
      SELECT c."proyectoConfirmado", c."areasConfirmadas"
      INTO proyecto_confirmado, areas_confirmadas
      FROM public."InspeccionControlV2" c
      WHERE c."inspeccionId" = new."id";

      IF NOT coalesce(proyecto_confirmado, false) THEN
        RAISE EXCEPTION USING message = 'No se puede finalizar la V1: falta confirmar si existe proyecto PDF o declarar formalmente que no está disponible.', errcode = '23514';
      END IF;

      IF NOT coalesce(areas_confirmadas, false) THEN
        RAISE EXCEPTION USING message = 'No se puede finalizar la V1: falta confirmar el ecosistema de áreas contratado.', errcode = '23514';
      END IF;

      SELECT count(*) INTO areas_obligatorias
      FROM public."AreaInspeccion" a
      WHERE a."inspeccionId" = new."id" AND a."obligatoria" = true;

      IF areas_obligatorias = 0 THEN
        RAISE EXCEPTION USING message = 'No se puede finalizar la V1: no existen áreas obligatorias declaradas.', errcode = '23514';
      END IF;

      SELECT count(*) INTO areas_incompletas
      FROM public."AreaInspeccion" a
      WHERE a."inspeccionId" = new."id"
        AND a."obligatoria" = true
        AND (
          a."estado" <> 'REVISADA'
          OR a."resultado" NOT IN ('SIN_HALLAZGOS','CON_HALLAZGOS')
          OR nullif(btrim(coalesce(a."comentarioFinal", '')), '') IS NULL
          OR (
            a."resultado" = 'SIN_HALLAZGOS' AND (
              (SELECT count(*) FROM public."FotografiaArea" fa WHERE fa."areaId" = a."id") < 1
              OR (SELECT count(*) FROM public."FotografiaArea" fa WHERE fa."areaId" = a."id" AND fa."seleccionadaReporte" = true) NOT BETWEEN 1 AND 4
            )
          )
          OR EXISTS (
            SELECT 1 FROM public."GuiaInspeccionItem" g
            WHERE g."areaId" = a."id" AND g."obligatorio" = true AND g."estadoV3" = 'PENDIENTE'
          )
        );

      IF areas_incompletas > 0 THEN
        RAISE EXCEPTION USING message = format('No se puede finalizar la V1: %s área(s) obligatoria(s) siguen incompletas.', areas_incompletas), errcode = '23514';
      END IF;

      SELECT count(*) INTO hallazgos_incompletos
      FROM public."Hallazgo" h
      WHERE h."inspeccionId" = new."id"
        AND (
          (SELECT count(*) FROM public."Fotografia" f WHERE f."hallazgoId" = h."id" AND f."inspeccionId" = new."id") NOT BETWEEN 1 AND 4
          OR nullif(btrim(coalesce(h."descripcion", '')), '') IS NULL
        );

      IF hallazgos_incompletos > 0 THEN
        RAISE EXCEPTION USING message = format('No se puede finalizar la V1: %s hallazgo(s) no tienen una descripción final o están fuera del rango de 1 a 4 fotografías.', hallazgos_incompletos), errcode = '23514';
      END IF;

      SELECT count(*) INTO pasos_incompletos
      FROM public."ProtocoloInspeccionPaso" p
      WHERE p."inspeccionId" = new."id"
        AND p."obligatorio" = true
        AND p."estado" NOT IN ('COMPLETADO','NO_APLICA');

      IF pasos_incompletos > 0 THEN
        RAISE EXCEPTION USING message = format('No se puede finalizar la V1: %s proceso(s) obligatorio(s) siguen pendientes.', pasos_incompletos), errcode = '23514';
      END IF;

      SELECT count(*) INTO fotos_fachada
      FROM public."AreaInspeccion" a
      JOIN public."FotografiaArea" fa ON fa."areaId" = a."id"
      WHERE a."inspeccionId" = new."id"
        AND a."codigo" IN ('FACHADA_FRONTAL','FACHADA_PRINCIPAL');

      SELECT count(*) INTO portadas_fachada
      FROM public."AreaInspeccion" a
      JOIN public."FotografiaArea" fa ON fa."areaId" = a."id"
      WHERE a."inspeccionId" = new."id"
        AND a."codigo" IN ('FACHADA_FRONTAL','FACHADA_PRINCIPAL')
        AND fa."candidataPortada" = true;

      IF fotos_fachada < 1 THEN
        RAISE EXCEPTION USING message = 'No se puede finalizar la V1: la fachada frontal requiere al menos una fotografía.', errcode = '23514';
      END IF;

      IF portadas_fachada <> 1 THEN
        RAISE EXCEPTION USING message = 'No se puede finalizar la V1: selecciona exactamente una fotografía de fachada para la portada.', errcode = '23514';
      END IF;
    END IF;
  END IF;

  RETURN new;
END;
$function$;
