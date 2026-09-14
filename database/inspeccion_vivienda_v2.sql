-- Certeza Habitacional · Inspección de vivienda V2
-- Compatible con DocumentoProyectoInspeccion, GuiaInspeccionItem y SeleccionEvidenciaReporte existentes.
-- Validar primero en CertezaHabitacional-DEV antes de producción.

-- 1. Seguridad y metadatos para estructuras ya existentes.
alter table public."DocumentoProyectoInspeccion" enable row level security;
alter table public."GuiaInspeccionItem" enable row level security;
alter table public."SeleccionEvidenciaReporte" enable row level security;

alter table public."DocumentoProyectoInspeccion"
  add column if not exists "estadoAnalisis" text not null default 'PENDIENTE',
  add column if not exists "numeroPaginas" integer,
  add column if not exists "datosExtraidos" jsonb,
  add column if not exists "observaciones" text;

create index if not exists "DocumentoProyectoInspeccion_subidoPorId_idx"
  on public."DocumentoProyectoInspeccion"("subidoPorId");
create index if not exists "GuiaInspeccionItem_creadoPorId_idx"
  on public."GuiaInspeccionItem"("creadoPorId");
create index if not exists "SeleccionEvidenciaReporte_seleccionadaPorId_idx"
  on public."SeleccionEvidenciaReporte"("seleccionadaPorId");

-- 2. Control de versión, cierre y reapertura de la inspección.
create table if not exists public."InspeccionControlV2" (
  "id" uuid primary key default gen_random_uuid(),
  "inspeccionId" text not null unique references public."Inspeccion"("id") on delete cascade,
  "categoria" text not null default 'VIVIENDA',
  "versionProtocolo" integer not null default 2,
  "proyectoConfirmado" boolean not null default false,
  "areasConfirmadas" boolean not null default false,
  "capturaCerrada" boolean not null default false,
  "capturaCerradaEn" timestamptz,
  "capturaCerradaPorId" text references public."Usuario"("id") on delete set null,
  "reabiertaEn" timestamptz,
  "reabiertaPorId" text references public."Usuario"("id") on delete set null,
  "motivoReapertura" text,
  "creadoEn" timestamptz not null default now(),
  "actualizadoEn" timestamptz not null default now()
);

-- 3. Áreas físicas obligatorias. Cada área existe aunque no tenga hallazgos.
create table if not exists public."AreaInspeccion" (
  "id" uuid primary key default gen_random_uuid(),
  "inspeccionId" text not null references public."Inspeccion"("id") on delete cascade,
  "codigo" text not null,
  "nombre" text not null,
  "tipo" text not null,
  "orden" integer not null default 0,
  "origen" text not null default 'MANUAL',
  "obligatoria" boolean not null default true,
  "ubicacion" text,
  "dimensiones" jsonb,
  "especificaciones" jsonb,
  "estado" text not null default 'PENDIENTE',
  "comentarioFinal" text,
  "revisadaEn" timestamptz,
  "creadoEn" timestamptz not null default now(),
  "actualizadoEn" timestamptz not null default now(),
  unique ("inspeccionId", "codigo")
);

alter table public."GuiaInspeccionItem"
  add column if not exists "areaId" uuid references public."AreaInspeccion"("id") on delete set null;

-- 4. Protocolo secuencial: fachada, pruebas iniciales, recorrido, pruebas finales y cierre.
create table if not exists public."ProtocoloInspeccionPaso" (
  "id" uuid primary key default gen_random_uuid(),
  "inspeccionId" text not null references public."Inspeccion"("id") on delete cascade,
  "areaId" uuid references public."AreaInspeccion"("id") on delete set null,
  "clave" text not null,
  "nombre" text not null,
  "tipo" text not null default 'GENERAL',
  "orden" integer not null,
  "obligatorio" boolean not null default true,
  "estado" text not null default 'PENDIENTE',
  "lecturaInicial" numeric(12,4),
  "lecturaFinal" numeric(12,4),
  "unidad" text,
  "datos" jsonb,
  "comentario" text,
  "iniciadoEn" timestamptz,
  "completadoEn" timestamptz,
  "creadoEn" timestamptz not null default now(),
  "actualizadoEn" timestamptz not null default now(),
  unique ("inspeccionId", "clave")
);

-- 5. Evidencia de cobertura por área, independiente de que exista hallazgo.
create table if not exists public."FotografiaArea" (
  "id" uuid primary key default gen_random_uuid(),
  "fotografiaId" text not null unique references public."Fotografia"("id") on delete cascade,
  "areaId" uuid not null references public."AreaInspeccion"("id") on delete cascade,
  "tipoEvidencia" text not null default 'RECORRIDO',
  "orden" integer not null default 0,
  "candidataReporte" boolean not null default true,
  "candidataPortada" boolean not null default false,
  "creadoEn" timestamptz not null default now()
);

-- 6. Video complementario para área o hallazgo.
create table if not exists public."VideoInspeccion" (
  "id" uuid primary key default gen_random_uuid(),
  "inspeccionId" text not null references public."Inspeccion"("id") on delete cascade,
  "areaId" uuid references public."AreaInspeccion"("id") on delete set null,
  "hallazgoId" text references public."Hallazgo"("id") on delete set null,
  "rutaStorage" text not null,
  "bucket" text not null default 'evidencias-inspeccion',
  "mimeType" text,
  "bytes" integer,
  "descripcion" text,
  "duracionSegundos" integer,
  "creadoPorId" text references public."Usuario"("id") on delete set null,
  "creadoEn" timestamptz not null default now()
);

-- 7. La IA propone; el Inspector conserva el texto final.
create table if not exists public."InterpretacionIAHallazgo" (
  "id" uuid primary key default gen_random_uuid(),
  "hallazgoId" text not null unique references public."Hallazgo"("id") on delete cascade,
  "modelo" text,
  "entrada" jsonb,
  "interpretacionSugerida" text not null,
  "recomendacionSugerida" text,
  "aceptadaSinCambios" boolean,
  "textoFinalInspector" text,
  "revisadaEn" timestamptz,
  "creadoEn" timestamptz not null default now()
);

-- 8. Cola idempotente para captura offline y sincronización posterior.
create table if not exists public."OperacionCampoSync" (
  "id" uuid primary key default gen_random_uuid(),
  "clientMutationId" uuid not null unique,
  "inspeccionId" text not null references public."Inspeccion"("id") on delete cascade,
  "usuarioId" text not null references public."Usuario"("id") on delete restrict,
  "tipo" text not null,
  "payload" jsonb not null,
  "estado" text not null default 'RECIBIDA',
  "error" text,
  "creadaClienteEn" timestamptz,
  "recibidaEn" timestamptz not null default now(),
  "procesadaEn" timestamptz
);

-- 9. Índices de relaciones y consultas operativas.
create index if not exists "InspeccionControlV2_capturaCerradaPorId_idx" on public."InspeccionControlV2"("capturaCerradaPorId");
create index if not exists "InspeccionControlV2_reabiertaPorId_idx" on public."InspeccionControlV2"("reabiertaPorId");
create index if not exists "AreaInspeccion_inspeccionId_orden_idx" on public."AreaInspeccion"("inspeccionId", "orden");
create index if not exists "AreaInspeccion_estado_idx" on public."AreaInspeccion"("estado");
create index if not exists "GuiaInspeccionItem_areaId_idx" on public."GuiaInspeccionItem"("areaId");
create index if not exists "ProtocoloInspeccionPaso_inspeccionId_orden_idx" on public."ProtocoloInspeccionPaso"("inspeccionId", "orden");
create index if not exists "ProtocoloInspeccionPaso_areaId_idx" on public."ProtocoloInspeccionPaso"("areaId");
create index if not exists "FotografiaArea_areaId_idx" on public."FotografiaArea"("areaId");
create index if not exists "VideoInspeccion_inspeccionId_idx" on public."VideoInspeccion"("inspeccionId");
create index if not exists "VideoInspeccion_areaId_idx" on public."VideoInspeccion"("areaId");
create index if not exists "VideoInspeccion_hallazgoId_idx" on public."VideoInspeccion"("hallazgoId");
create index if not exists "VideoInspeccion_creadoPorId_idx" on public."VideoInspeccion"("creadoPorId");
create index if not exists "OperacionCampoSync_inspeccionId_idx" on public."OperacionCampoSync"("inspeccionId");
create index if not exists "OperacionCampoSync_usuarioId_idx" on public."OperacionCampoSync"("usuarioId");
create index if not exists "OperacionCampoSync_estado_idx" on public."OperacionCampoSync"("estado");

-- 10. RLS: no se exponen estas tablas directamente al navegador en la primera versión.
alter table public."InspeccionControlV2" enable row level security;
alter table public."AreaInspeccion" enable row level security;
alter table public."ProtocoloInspeccionPaso" enable row level security;
alter table public."FotografiaArea" enable row level security;
alter table public."VideoInspeccion" enable row level security;
alter table public."InterpretacionIAHallazgo" enable row level security;
alter table public."OperacionCampoSync" enable row level security;

-- 11. Regla de cierre compatible con expedientes históricos y V2.
-- V2 elimina la falsa obligación de tener al menos un hallazgo: una vivienda puede estar en aparente orden,
-- pero todas las áreas obligatorias deben quedar revisadas, comentadas y con 4+ fotografías.
create or replace function public.validar_evidencia_minima_cierre_inspeccion()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  total_hallazgos integer;
  hallazgos_incompletos integer;
  usa_v2 boolean;
  proyecto_confirmado boolean;
  areas_confirmadas boolean;
  areas_obligatorias integer;
  areas_incompletas integer;
  pasos_incompletos integer;
begin
  if new."estado" = 'REPORTE_PENDIENTE' and old."estado" is distinct from new."estado" then
    select exists(
      select 1 from public."InspeccionControlV2" c where c."inspeccionId" = new."id"
    ) into usa_v2;

    if usa_v2 then
      select c."proyectoConfirmado", c."areasConfirmadas"
        into proyecto_confirmado, areas_confirmadas
      from public."InspeccionControlV2" c
      where c."inspeccionId" = new."id";

      if not coalesce(proyecto_confirmado, false) then
        raise exception using message = 'No se puede finalizar la captura: falta confirmar proyecto PDF o declarar formalmente que no existe proyecto disponible.', errcode = '23514';
      end if;

      if not coalesce(areas_confirmadas, false) then
        raise exception using message = 'No se puede finalizar la captura: falta confirmar el ecosistema de áreas de la vivienda.', errcode = '23514';
      end if;

      select count(*) into areas_obligatorias
      from public."AreaInspeccion" a
      where a."inspeccionId" = new."id" and a."obligatoria" = true;

      if areas_obligatorias = 0 then
        raise exception using message = 'No se puede finalizar la captura: no existen áreas obligatorias declaradas para la vivienda.', errcode = '23514';
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
            where fa."areaId" = a."id" and f."inspeccionId" = new."id"
          ) < 4
        );

      if areas_incompletas > 0 then
        raise exception using message = format('No se puede finalizar la captura: %s área(s) obligatoria(s) siguen sin revisión completa, comentario o 4 fotografías.', areas_incompletas), errcode = '23514';
      end if;

      select count(*) into pasos_incompletos
      from public."ProtocoloInspeccionPaso" p
      where p."inspeccionId" = new."id"
        and p."obligatorio" = true
        and p."estado" not in ('COMPLETADO', 'NO_APLICA');

      if pasos_incompletos > 0 then
        raise exception using message = format('No se puede finalizar la captura: %s paso(s) obligatorio(s) del protocolo siguen pendientes.', pasos_incompletos), errcode = '23514';
      end if;

      if not exists (
        select 1
        from public."AreaInspeccion" a
        join public."FotografiaArea" fa on fa."areaId" = a."id"
        where a."inspeccionId" = new."id"
          and a."codigo" = 'FACHADA_PRINCIPAL'
          and fa."candidataPortada" = true
      ) then
        raise exception using message = 'No se puede finalizar la captura: falta seleccionar evidencia de fachada principal para identificación/portada.', errcode = '23514';
      end if;
    else
      -- Compatibilidad con expedientes anteriores a V2.
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
          where f."hallazgoId" = h."id" and f."inspeccionId" = new."id"
        ) < 4;

      if hallazgos_incompletos > 0 then
        raise exception using message = format('No se puede finalizar la captura: %s hallazgo(s) tienen menos de 4 evidencias fotográficas.', hallazgos_incompletos), errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end;
$function$;
