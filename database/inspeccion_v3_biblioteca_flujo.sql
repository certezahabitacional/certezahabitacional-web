-- Certeza Habitacional · Inspección V3
-- Biblioteca maestra, puntos por área, cierre rápido, pre-reporte y control de tiempos.
-- Aplicar primero en DEV.

create table if not exists public."BibliotecaAreaCerteza" (
  "id" uuid primary key default gen_random_uuid(),
  "codigo" text not null unique,
  "nombre" text not null,
  "categoria" text not null default 'INTERIOR',
  "descripcion" text,
  "activa" boolean not null default true,
  "orden" integer not null default 0,
  "creadoEn" timestamptz not null default now(),
  "actualizadoEn" timestamptz not null default now()
);

create table if not exists public."BibliotecaPuntoCerteza" (
  "id" uuid primary key default gen_random_uuid(),
  "codigo" text not null unique,
  "grupo" text not null,
  "nombre" text not null,
  "descripcion" text,
  "modulo" text not null default 'BASE',
  "obligatorioDefault" boolean not null default true,
  "permiteNoAplica" boolean not null default true,
  "requiereMedicion" boolean not null default false,
  "requiereComparacionProyecto" boolean not null default false,
  "herramientaSugerida" text,
  "textoSinHallazgo" text,
  "orden" integer not null default 0,
  "activa" boolean not null default true,
  "creadoEn" timestamptz not null default now(),
  "actualizadoEn" timestamptz not null default now()
);

create table if not exists public."BibliotecaAreaPuntoCerteza" (
  "id" uuid primary key default gen_random_uuid(),
  "areaBibliotecaId" uuid not null references public."BibliotecaAreaCerteza"("id") on delete cascade,
  "puntoBibliotecaId" uuid not null references public."BibliotecaPuntoCerteza"("id") on delete cascade,
  "obligatorio" boolean not null default true,
  "orden" integer not null default 0,
  "configuracion" jsonb,
  unique ("areaBibliotecaId", "puntoBibliotecaId")
);

alter table public."AreaInspeccion"
  add column if not exists "bibliotecaAreaId" uuid references public."BibliotecaAreaCerteza"("id") on delete set null,
  add column if not exists "resultado" text,
  add column if not exists "cerradaPorId" text references public."Usuario"("id") on delete set null,
  add column if not exists "cerradaEn" timestamptz,
  add column if not exists "textoSinHallazgo" text,
  add column if not exists "excluirReporte" boolean not null default false;

alter table public."GuiaInspeccionItem"
  add column if not exists "bibliotecaPuntoId" uuid references public."BibliotecaPuntoCerteza"("id") on delete set null,
  add column if not exists "estadoV3" text not null default 'PENDIENTE',
  add column if not exists "motivoNoAplica" text,
  add column if not exists "origenV3" text not null default 'BIBLIOTECA',
  add column if not exists "requiereMedicion" boolean not null default false,
  add column if not exists "requiereComparacionProyecto" boolean not null default false,
  add column if not exists "herramientaSugerida" text,
  add column if not exists "valorMedido" text,
  add column if not exists "valorProyecto" text,
  add column if not exists "unidadMedida" text,
  add column if not exists "cerradoEn" timestamptz;

alter table public."FotografiaArea"
  add column if not exists "guiaItemId" text references public."GuiaInspeccionItem"("id") on delete set null,
  add column if not exists "seleccionadaReporte" boolean not null default false;

alter table public."Hallazgo"
  add column if not exists "areaId" uuid references public."AreaInspeccion"("id") on delete set null,
  add column if not exists "guiaItemId" text references public."GuiaInspeccionItem"("id") on delete set null,
  add column if not exists "cerradoEn" timestamptz,
  add column if not exists "textoIaOriginal" text,
  add column if not exists "textoInspectorFinal" text;

alter table public."InspeccionControlV2"
  add column if not exists "versionProtocoloV3" integer not null default 3,
  add column if not exists "campoIniciadoEn" timestamptz,
  add column if not exists "campoFinalizadoEn" timestamptz,
  add column if not exists "reporteLimiteEn" timestamptz,
  add column if not exists "preReporteGeneradoEn" timestamptz,
  add column if not exists "calificacionPreliminar" numeric(5,2),
  add column if not exists "calificacionFinal" numeric(5,2),
  add column if not exists "coberturaPorcentaje" numeric(5,2),
  add column if not exists "resumenEstadistico" jsonb;

create table if not exists public."PreReporteInspeccion" (
  "id" uuid primary key default gen_random_uuid(),
  "inspeccionId" text not null references public."Inspeccion"("id") on delete cascade,
  "version" integer not null default 1,
  "generadoEn" timestamptz not null default now(),
  "generadoPorId" text references public."Usuario"("id") on delete set null,
  "calificacionPreliminar" numeric(5,2),
  "coberturaPorcentaje" numeric(5,2),
  "resumen" jsonb not null default '{}'::jsonb,
  "decisionCliente" text,
  "decisionRegistradaEn" timestamptz,
  "firmaCliente" text,
  "leyenda" text not null default 'PRELIMINAR - PENDIENTE DE REVISION Y AUTORIZACION',
  unique ("inspeccionId", "version")
);

create index if not exists "BibliotecaAreaPunto_area_idx" on public."BibliotecaAreaPuntoCerteza"("areaBibliotecaId", "orden");
create index if not exists "BibliotecaAreaPunto_punto_idx" on public."BibliotecaAreaPuntoCerteza"("puntoBibliotecaId");
create index if not exists "AreaInspeccion_bibliotecaArea_idx" on public."AreaInspeccion"("bibliotecaAreaId");
create index if not exists "GuiaInspeccionItem_bibliotecaPunto_idx" on public."GuiaInspeccionItem"("bibliotecaPuntoId");
create index if not exists "GuiaInspeccionItem_estadoV3_idx" on public."GuiaInspeccionItem"("estadoV3");
create index if not exists "FotografiaArea_guiaItem_idx" on public."FotografiaArea"("guiaItemId");
create index if not exists "Hallazgo_areaId_idx" on public."Hallazgo"("areaId");
create index if not exists "Hallazgo_guiaItemId_idx" on public."Hallazgo"("guiaItemId");
create index if not exists "PreReporteInspeccion_inspeccion_idx" on public."PreReporteInspeccion"("inspeccionId", "version");

alter table public."BibliotecaAreaCerteza" enable row level security;
alter table public."BibliotecaPuntoCerteza" enable row level security;
alter table public."BibliotecaAreaPuntoCerteza" enable row level security;
alter table public."PreReporteInspeccion" enable row level security;

-- Estados válidos V3.
alter table public."GuiaInspeccionItem" drop constraint if exists "GuiaInspeccionItem_estadoV3_check";
alter table public."GuiaInspeccionItem" add constraint "GuiaInspeccionItem_estadoV3_check"
  check ("estadoV3" in ('PENDIENTE','REVISADO','CON_HALLAZGO','NO_APLICA'));

alter table public."AreaInspeccion" drop constraint if exists "AreaInspeccion_resultado_check";
alter table public."AreaInspeccion" add constraint "AreaInspeccion_resultado_check"
  check ("resultado" is null or "resultado" in ('SIN_HALLAZGOS','CON_HALLAZGOS','NO_APLICA'));

-- Un punto mínimo puede marcarse NO_APLICA, pero debe quedar justificado.
create or replace function public.validar_no_aplica_guia_v3()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new."estadoV3" = 'NO_APLICA' and nullif(btrim(coalesce(new."motivoNoAplica", '')), '') is null then
    raise exception using message = 'Para marcar un punto como NO APLICA se requiere una justificación.', errcode = '23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists "trg_validar_no_aplica_guia_v3" on public."GuiaInspeccionItem";
create trigger "trg_validar_no_aplica_guia_v3"
before insert or update of "estadoV3", "motivoNoAplica" on public."GuiaInspeccionItem"
for each row execute function public.validar_no_aplica_guia_v3();

-- Cierre V3 de área: todos los puntos obligatorios aplicables deben quedar atendidos.
-- Sin hallazgos: evidencia de área mínima 1, máxima 4 seleccionadas para reporte.
create or replace function public.validar_cierre_area_v3()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  pendientes integer;
  fotos_area integer;
  seleccionadas integer;
begin
  if new."estado" = 'REVISADA' and old."estado" is distinct from new."estado" then
    select count(*) into pendientes
    from public."GuiaInspeccionItem" g
    where g."areaId" = new."id"
      and g."obligatorio" = true
      and g."estadoV3" = 'PENDIENTE';

    if pendientes > 0 then
      raise exception using message = format('No se puede cerrar el área: %s punto(s) obligatorio(s) siguen pendientes.', pendientes), errcode = '23514';
    end if;

    if new."resultado" = 'SIN_HALLAZGOS' then
      select count(*) into fotos_area from public."FotografiaArea" fa where fa."areaId" = new."id";
      select count(*) into seleccionadas from public."FotografiaArea" fa where fa."areaId" = new."id" and fa."seleccionadaReporte" = true;
      if fotos_area < 1 then
        raise exception using message = 'No se puede cerrar un área sin hallazgos sin al menos una fotografía de evidencia.', errcode = '23514';
      end if;
      if seleccionadas < 1 or seleccionadas > 4 then
        raise exception using message = 'Un área sin hallazgos debe tener entre 1 y 4 fotografías seleccionadas para el reporte.', errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists "trg_validar_cierre_area_v3" on public."AreaInspeccion";
create trigger "trg_validar_cierre_area_v3"
before update of "estado" on public."AreaInspeccion"
for each row execute function public.validar_cierre_area_v3();
