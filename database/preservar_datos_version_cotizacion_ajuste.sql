-- Preserva el snapshot completo de la cotizacion cuando una nueva version
-- se genera por un ajuste comercial. Aplicado y verificado primero en DEV.

create or replace function public.preservar_datos_version_cotizacion_ajuste()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  datos_previos jsonb;
  datos_ajuste jsonb;
begin
  if coalesce(new."datos"->>'origen', '') = 'AJUSTE_COMERCIAL' then
    datos_ajuste := new."datos";

    select cv."datos"
      into datos_previos
    from public."CotizacionVersion" cv
    where cv."cotizacionId" = new."cotizacionId"
      and cv."version" < new."version"
    order by cv."version" desc
    limit 1;

    if datos_previos is not null then
      new."datos" := datos_previos || datos_ajuste || jsonb_build_object(
        '_ajusteComercial', datos_ajuste
      );
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.preservar_datos_version_cotizacion_ajuste()
  from public, anon, authenticated;

drop trigger if exists "CotizacionVersion_preservar_datos_ajuste_trg"
  on public."CotizacionVersion";

create trigger "CotizacionVersion_preservar_datos_ajuste_trg"
before insert on public."CotizacionVersion"
for each row
execute function public.preservar_datos_version_cotizacion_ajuste();
