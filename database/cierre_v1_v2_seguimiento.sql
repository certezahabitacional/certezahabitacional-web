-- Certeza Habitacional · cierre de captura por número de visita
-- V1 = inspección integral. V2+ = seguimiento de pendientes de la visita anterior.
-- Aplicar primero en DEV.

create or replace function public.validar_evidencia_minima_cierre_inspeccion()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  total_hallazgos integer;
  hallazgos_incompletos integer;
  usa_metodo boolean;
  proyecto_confirmado boolean;
  areas_confirmadas boolean;
  areas_obligatorias integer;
  areas_incompletas integer;
  pasos_requeridos_faltantes integer;
  pasos_incompletos integer;
  pruebas_invalidas integer;
  antecedentes_pendientes integer;
  antecedentes_sin_seguimiento integer;
  seguimientos_invalidos integer;
  evidencias_v2_incompletas integer;
begin
  if new."estado" = 'REPORTE_PENDIENTE' and old."estado" is distinct from new."estado" then
    select exists(
      select 1
      from public."InspeccionControlV2" c
      where c."inspeccionId" = new."id"
    ) into usa_metodo;

    if usa_metodo and coalesce(new."numeroInspeccion", 1) = 1 then
      -- V1: cobertura integral de vivienda, aunque no existan hallazgos.
      select c."proyectoConfirmado", c."areasConfirmadas"
        into proyecto_confirmado, areas_confirmadas
      from public."InspeccionControlV2" c
      where c."inspeccionId" = new."id";

      if not coalesce(proyecto_confirmado, false) then
        raise exception using message = 'No se puede finalizar V1: falta confirmar proyecto PDF o declarar formalmente que no existe proyecto disponible.', errcode = '23514';
      end if;

      if not coalesce(areas_confirmadas, false) then
        raise exception using message = 'No se puede finalizar V1: falta confirmar el ecosistema de áreas de la vivienda.', errcode = '23514';
      end if;

      select count(*) into areas_obligatorias
      from public."AreaInspeccion" a
      where a."inspeccionId" = new."id" and a."obligatoria" = true;

      if areas_obligatorias = 0 then
        raise exception using message = 'No se puede finalizar V1: no existen áreas obligatorias declaradas para la vivienda.', errcode = '23514';
      end if;

      select count(*) into areas_incompletas
      from public."AreaInspeccion" a
      where a."inspeccionId" = new."id"
        and a."obligatoria" = true
        and (
          a."estado" <> 'REVISADA'
          or nullif(btrim(coalesce(a."comentarioFinal", '')), '') is null
          or (
            select count(*)
            from public."FotografiaArea" fa
            join public."Fotografia" f on f."id" = fa."fotografiaId"
            where fa."areaId" = a."id"
              and f."inspeccionId" = new."id"
          ) < 4
        );

      if areas_incompletas > 0 then
        raise exception using message = format('No se puede finalizar V1: %s área(s) obligatoria(s) siguen sin revisión completa, comentario o 4 fotografías.', areas_incompletas), errcode = '23514';
      end if;

      -- La V1 siempre debe tener la secuencia mínima del Método Certeza.
      select count(*) into pasos_requeridos_faltantes
      from (
        values
          ('FACHADA_PRINCIPAL'),
          ('HIDRAULICA_INICIO'),
          ('GAS_INICIO'),
          ('RECORRIDO_AREAS'),
          ('HIDRAULICA_CIERRE'),
          ('GAS_CIERRE'),
          ('CIERRE_CAMPO')
      ) as requeridos(clave)
      where not exists (
        select 1
        from public."ProtocoloInspeccionPaso" p
        where p."inspeccionId" = new."id"
          and p."clave" = requeridos.clave
          and p."obligatorio" = true
      );

      if pasos_requeridos_faltantes > 0 then
        raise exception using message = format('No se puede finalizar V1: faltan %s paso(s) base del protocolo del Método Certeza.', pasos_requeridos_faltantes), errcode = '23514';
      end if;

      select count(*) into pasos_incompletos
      from public."ProtocoloInspeccionPaso" p
      where p."inspeccionId" = new."id"
        and p."obligatorio" = true
        and p."estado" not in ('COMPLETADO', 'NO_APLICA');

      if pasos_incompletos > 0 then
        raise exception using message = format('No se puede finalizar V1: %s paso(s) obligatorio(s) del protocolo siguen pendientes.', pasos_incompletos), errcode = '23514';
      end if;

      -- Hidráulica y gas deben quedar como pares consistentes: ambos NO_APLICA,
      -- o ambos COMPLETADOS con lectura inicial/final, unidad y secuencia temporal válida.
      select count(*) into pruebas_invalidas
      from (
        values ('HIDRAULICA'), ('GAS')
      ) as sistemas(sistema)
      join public."ProtocoloInspeccionPaso" inicio
        on inicio."inspeccionId" = new."id"
       and inicio."clave" = sistemas.sistema || '_INICIO'
      join public."ProtocoloInspeccionPaso" cierre
        on cierre."inspeccionId" = new."id"
       and cierre."clave" = sistemas.sistema || '_CIERRE'
      where
        (
          (inicio."estado" = 'NO_APLICA') <> (cierre."estado" = 'NO_APLICA')
        )
        or (
          inicio."estado" <> 'NO_APLICA'
          and (
            inicio."estado" <> 'COMPLETADO'
            or cierre."estado" <> 'COMPLETADO'
            or inicio."lecturaInicial" is null
            or cierre."lecturaFinal" is null
            or nullif(btrim(coalesce(inicio."unidad", '')), '') is null
            or nullif(btrim(coalesce(cierre."unidad", '')), '') is null
            or lower(btrim(inicio."unidad")) <> lower(btrim(cierre."unidad"))
            or inicio."completadoEn" is null
            or cierre."completadoEn" is null
            or cierre."completadoEn" < inicio."completadoEn"
          )
        );

      if pruebas_invalidas > 0 then
        raise exception using message = 'No se puede finalizar V1: las pruebas hidráulica y/o de gas no tienen un inicio/cierre coherente con lecturas, unidad y secuencia temporal válidas.', errcode = '23514';
      end if;

      if not exists (
        select 1
        from public."AreaInspeccion" a
        join public."FotografiaArea" fa on fa."areaId" = a."id"
        join public."Fotografia" f on f."id" = fa."fotografiaId"
        where a."inspeccionId" = new."id"
          and a."codigo" = 'FACHADA_PRINCIPAL'
          and fa."candidataPortada" = true
          and f."inspeccionId" = new."id"
      ) then
        raise exception using message = 'No se puede finalizar V1: falta seleccionar evidencia de fachada principal para identificación/portada.', errcode = '23514';
      end if;

    elsif usa_metodo and coalesce(new."numeroInspeccion", 1) > 1 then
      -- V2+: únicamente los pendientes de la visita inmediatamente anterior.
      if new."inspeccionAnteriorId" is null then
        raise exception using message = 'No se puede finalizar el seguimiento: falta vincular la inspección inmediatamente anterior.', errcode = '23514';
      end if;

      select count(*) into antecedentes_pendientes
      from public."Hallazgo" h
      where h."inspeccionId" = new."inspeccionAnteriorId"
        and coalesce(h."resuelto", false) = false
        and coalesce(h."estadoSeguimiento"::text, '') <> 'CORREGIDO';

      select count(*) into antecedentes_sin_seguimiento
      from public."Hallazgo" h
      where h."inspeccionId" = new."inspeccionAnteriorId"
        and coalesce(h."resuelto", false) = false
        and coalesce(h."estadoSeguimiento"::text, '') <> 'CORREGIDO'
        and not exists (
          select 1
          from public."Hallazgo" s
          where s."inspeccionId" = new."id"
            and s."hallazgoAnteriorId" = h."id"
        );

      if antecedentes_sin_seguimiento > 0 then
        raise exception using message = format('No se puede finalizar V%s: faltan por verificar %s hallazgo(s) pendiente(s) de V%s.', new."numeroInspeccion", antecedentes_sin_seguimiento, new."numeroInspeccion" - 1), errcode = '23514';
      end if;

      select count(*) into seguimientos_invalidos
      from public."Hallazgo" s
      where s."inspeccionId" = new."id"
        and s."hallazgoAnteriorId" is not null
        and (
          s."estadoSeguimiento" is null
          or s."estadoSeguimiento"::text not in (
            'CORREGIDO',
            'PARCIALMENTE_CORREGIDO',
            'NO_CORREGIDO',
            'CORRECCION_NO_SATISFACTORIA',
            'NO_VERIFICABLE'
          )
          or nullif(btrim(coalesce(s."observacionSeguimiento", '')), '') is null
        );

      if seguimientos_invalidos > 0 then
        raise exception using message = format('No se puede finalizar V%s: %s seguimiento(s) no tienen estado u observación final válida.', new."numeroInspeccion", seguimientos_invalidos), errcode = '23514';
      end if;

      -- En V2+ cada verificación y cada nuevo hallazgo conserva evidencia suficiente.
      select count(*) into evidencias_v2_incompletas
      from public."Hallazgo" h
      where h."inspeccionId" = new."id"
        and (
          select count(*)
          from public."Fotografia" f
          where f."hallazgoId" = h."id"
            and f."inspeccionId" = new."id"
        ) < 4;

      if evidencias_v2_incompletas > 0 then
        raise exception using message = format('No se puede finalizar V%s: %s verificación(es) o hallazgo(s) tienen menos de 4 evidencias fotográficas.', new."numeroInspeccion", evidencias_v2_incompletas), errcode = '23514';
      end if;

      -- V2+ permite cero hallazgos nuevos; el requisito es resolver todos los antecedentes pendientes.
      -- Los hallazgos nuevos/solicitudes especiales siguen permitidos y se documentan en esta misma visita.

    else
      -- Compatibilidad con expedientes históricos anteriores al nuevo Método Certeza.
      select count(*) into total_hallazgos
      from public."Hallazgo" h
      where h."inspeccionId" = new."id";

      if total_hallazgos = 0 then
        raise exception using message = 'No se puede finalizar la captura: la inspección no tiene hallazgos registrados.', errcode = '23514';
      end if;

      select count(*) into hallazgos_incompletos
      from public."Hallazgo" h
      where h."inspeccionId" = new."id"
        and (
          select count(*)
          from public."Fotografia" f
          where f."hallazgoId" = h."id"
            and f."inspeccionId" = new."id"
        ) < 4;

      if hallazgos_incompletos > 0 then
        raise exception using message = format('No se puede finalizar la captura: %s hallazgo(s) tienen menos de 4 evidencias fotográficas.', hallazgos_incompletos), errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end;
$function$;
