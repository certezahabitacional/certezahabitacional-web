-- Migración: evidencia V1 de 1 a 4 fotografías por hallazgo/concepto.
-- Reemplaza la función de validación de cierre con la regla actualizada.

-- Certeza Habitacional · Reglas de cierre V1
-- 1-4 evidencias por concepto/hallazgo. Una sola descripción final por hallazgo.
-- Fachada principal: 4 fotografías y exactamente una seleccionada como portada.

create or replace function public.validar_evidencia_minima_cierre_inspeccion()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  usa_metodo boolean;
  proyecto_confirmado boolean;
  areas_confirmadas boolean;
  areas_obligatorias integer;
  areas_incompletas integer;
  pasos_incompletos integer;
  hallazgos_incompletos integer;
  fotos_fachada integer;
  portadas_fachada integer;
begin
  if new."estado" = 'REPORTE_PENDIENTE' and old."estado" is distinct from new."estado" then
    select exists(select 1 from public."InspeccionControlV2" c where c."inspeccionId" = new."id") into usa_metodo;

    if usa_metodo and new."numeroInspeccion" = 1 then
      select c."proyectoConfirmado", c."areasConfirmadas"
      into proyecto_confirmado, areas_confirmadas
      from public."InspeccionControlV2" c
      where c."inspeccionId" = new."id";

      if not coalesce(proyecto_confirmado, false) then
        raise exception using message = 'No se puede finalizar la V1: falta confirmar si existe proyecto PDF o declarar formalmente que no está disponible.', errcode = '23514';
      end if;

      if not coalesce(areas_confirmadas, false) then
        raise exception using message = 'No se puede finalizar la V1: falta confirmar el ecosistema de áreas contratado.', errcode = '23514';
      end if;

      select count(*) into areas_obligatorias
      from public."AreaInspeccion" a
      where a."inspeccionId" = new."id" and a."obligatoria" = true;

      if areas_obligatorias = 0 then
        raise exception using message = 'No se puede finalizar la V1: no existen áreas obligatorias declaradas.', errcode = '23514';
      end if;

      select count(*) into areas_incompletas
      from public."AreaInspeccion" a
      where a."inspeccionId" = new."id"
        and a."obligatoria" = true
        and (
          a."estado" <> 'REVISADA'
          or a."resultado" not in ('SIN_HALLAZGOS','CON_HALLAZGOS')
          or nullif(btrim(coalesce(a."comentarioFinal", '')), '') is null
          or (
            a."resultado" = 'SIN_HALLAZGOS' and (
              (select count(*) from public."FotografiaArea" fa where fa."areaId" = a."id") < 1
              or (select count(*) from public."FotografiaArea" fa where fa."areaId" = a."id" and fa."seleccionadaReporte" = true) not between 1 and 4
            )
          )
          or exists (
            select 1 from public."GuiaInspeccionItem" g
            where g."areaId" = a."id" and g."obligatorio" = true and g."estadoV3" = 'PENDIENTE'
          )
        );

      if areas_incompletas > 0 then
        raise exception using message = format('No se puede finalizar la V1: %s área(s) obligatoria(s) siguen incompletas.', areas_incompletas), errcode = '23514';
      end if;

      select count(*) into hallazgos_incompletos
      from public."Hallazgo" h
      where h."inspeccionId" = new."id"
        and (
          (select count(*) from public."Fotografia" f where f."hallazgoId" = h."id" and f."inspeccionId" = new."id") not between 1 and 4
          or nullif(btrim(coalesce(h."descripcion", '')), '') is null
        );

      if hallazgos_incompletos > 0 then
        raise exception using message = format('No se puede finalizar la V1: %s hallazgo(s) no tienen una descripción final o están fuera del rango de 1 a 4 fotografías.', hallazgos_incompletos), errcode = '23514';
      end if;

      select count(*) into pasos_incompletos
      from public."ProtocoloInspeccionPaso" p
      where p."inspeccionId" = new."id"
        and p."obligatorio" = true
        and p."estado" not in ('COMPLETADO','NO_APLICA');

      if pasos_incompletos > 0 then
        raise exception using message = format('No se puede finalizar la V1: %s proceso(s) obligatorio(s) siguen pendientes.', pasos_incompletos), errcode = '23514';
      end if;

      select count(*) into fotos_fachada
      from public."AreaInspeccion" a
      join public."FotografiaArea" fa on fa."areaId" = a."id"
      where a."inspeccionId" = new."id" and a."codigo" in ('FACHADA_FRONTAL','FACHADA_PRINCIPAL');

      select count(*) into portadas_fachada
      from public."AreaInspeccion" a
      join public."FotografiaArea" fa on fa."areaId" = a."id"
      where a."inspeccionId" = new."id" and a."codigo" in ('FACHADA_FRONTAL','FACHADA_PRINCIPAL') and fa."candidataPortada" = true;

      if fotos_fachada < 4 then
        raise exception using message = 'No se puede finalizar la V1: la fachada principal requiere 4 fotografías.', errcode = '23514';
      end if;
      if portadas_fachada <> 1 then
        raise exception using message = 'No se puede finalizar la V1: selecciona exactamente una fotografía de fachada para la portada.', errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end;
$function$;

