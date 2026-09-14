-- Certeza Habitacional · Inspección de vivienda V2
-- Ejecutar primero en CertezaHabitacional-DEV. No sustituye las tablas existentes.

create table if not exists public."InspeccionControlV2" (
  "id" uuid primary key default gen_random_uuid(),
  "inspeccionId" text not null unique references public."Inspeccion"("id") on delete cascade,
  "categoria" text not null default 'VIVIENDA',
  "versionProtocolo" integer not null default 2,
  "proyectoConfirmado" boolean not null default false,
  "areasConfirmadas" boolean not null default false,
  "capturaCerrada" boolean not null default false,
  "capturaCerradaEn" timestamptz,
  "reabiertaEn" timestamptz,
  "reabiertaPorId" text references public."Usuario"("id") on delete set null,
  "motivoReapertura" text,
  "creadoEn" timestamptz not null default now(),
  "actualizadoEn" timestamptz not null default now()
);

create table if not exists public."ProyectoInspeccion" (
  "id" uuid primary key default gen_random_uuid(),
  "inspeccionId" text not null unique references public."Inspeccion"("id") on delete cascade,
  "disponiblePdf" boolean not null default false,
  "nombreArchivo" text,
  "rutaStorage" text,
  "numeroPaginas" integer,
  "estadoAnalisis" text not null default 'PENDIENTE',
  "datosExtraidos" jsonb,
  "observaciones" text,
  "creadoEn" timestamptz not null default now(),
  "actualizadoEn" timestamptz not null default now()
);

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

create table if not exists public."ProtocoloInspeccionPaso" (
  "id" uuid primary key default gen_random_uuid(),
  "inspeccionId" text not null references public."Inspeccion"("id") on delete cascade,
  "areaId" uuid references public."AreaInspeccion"("id") on delete cascade,
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

create table if not exists public."VideoInspeccion" (
  "id" uuid primary key default gen_random_uuid(),
  "inspeccionId" text not null references public."Inspeccion"("id") on delete cascade,
  "areaId" uuid references public."AreaInspeccion"("id") on delete set null,
  "hallazgoId" text references public."Hallazgo"("id") on delete set null,
  "rutaStorage" text not null,
  "descripcion" text,
  "duracionSegundos" integer,
  "creadoPorId" text references public."Usuario"("id") on delete set null,
  "creadoEn" timestamptz not null default now()
);

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

create index if not exists "InspeccionControlV2_reabiertaPorId_idx" on public."InspeccionControlV2"("reabiertaPorId");
create index if not exists "AreaInspeccion_inspeccionId_orden_idx" on public."AreaInspeccion"("inspeccionId", "orden");
create index if not exists "AreaInspeccion_estado_idx" on public."AreaInspeccion"("estado");
create index if not exists "ProtocoloInspeccionPaso_inspeccionId_orden_idx" on public."ProtocoloInspeccionPaso"("inspeccionId", "orden");
create index if not exists "ProtocoloInspeccionPaso_areaId_idx" on public."ProtocoloInspeccionPaso"("areaId");
create index if not exists "FotografiaArea_areaId_idx" on public."FotografiaArea"("areaId");
create index if not exists "VideoInspeccion_inspeccionId_idx" on public."VideoInspeccion"("inspeccionId");
create index if not exists "VideoInspeccion_areaId_idx" on public."VideoInspeccion"("areaId");
create index if not exists "VideoInspeccion_hallazgoId_idx" on public."VideoInspeccion"("hallazgoId");
create index if not exists "OperacionCampoSync_inspeccionId_idx" on public."OperacionCampoSync"("inspeccionId");
create index if not exists "OperacionCampoSync_usuarioId_idx" on public."OperacionCampoSync"("usuarioId");
create index if not exists "OperacionCampoSync_estado_idx" on public."OperacionCampoSync"("estado");

alter table public."InspeccionControlV2" enable row level security;
alter table public."ProyectoInspeccion" enable row level security;
alter table public."AreaInspeccion" enable row level security;
alter table public."ProtocoloInspeccionPaso" enable row level security;
alter table public."FotografiaArea" enable row level security;
alter table public."VideoInspeccion" enable row level security;
alter table public."InterpretacionIAHallazgo" enable row level security;
alter table public."OperacionCampoSync" enable row level security;

-- Deliberadamente no se crean políticas para anon/authenticated.
-- El acceso inicial será exclusivamente server-side después de validar NextAuth, rol, zona y alcance de inspección.
