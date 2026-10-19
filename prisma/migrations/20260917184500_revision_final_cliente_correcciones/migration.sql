create table if not exists public."SolicitudCorreccionInspeccion" (
  "id" uuid primary key default gen_random_uuid(),
  "inspeccionId" text not null references public."Inspeccion"("id") on delete cascade,
  "tipo" text not null check ("tipo" in ('AREAS_DECLARADAS','DATOS_CLIENTE','DATOS_INMUEBLE','IMPORTE_COTIZACION')),
  "estado" text not null default 'PENDIENTE' check ("estado" in ('PENDIENTE','RESUELTA','CANCELADA')),
  "detalle" text,
  "solicitadaPorId" text not null references public."Usuario"("id") on delete restrict,
  "asignadaAId" text references public."Usuario"("id") on delete set null,
  "resueltaPorId" text references public."Usuario"("id") on delete set null,
  "solicitadaEn" timestamptz not null default now(),
  "resueltaEn" timestamptz,
  "comentarioResolucion" text
);

create index if not exists "SolicitudCorreccionInspeccion_inspeccionId_idx"
  on public."SolicitudCorreccionInspeccion"("inspeccionId");
create index if not exists "SolicitudCorreccionInspeccion_estado_idx"
  on public."SolicitudCorreccionInspeccion"("estado");
create index if not exists "SolicitudCorreccionInspeccion_asignadaAId_idx"
  on public."SolicitudCorreccionInspeccion"("asignadaAId");

alter table public."SolicitudCorreccionInspeccion" enable row level security;
revoke all on table public."SolicitudCorreccionInspeccion" from anon, authenticated;
