-- Certeza Habitacional · Historial estructurado e inmutable de cambios
-- Aplicar primero en DEV.

create table if not exists public."HistorialCambioSistema" (
  "id" uuid primary key default gen_random_uuid(),
  "usuarioId" text references public."Usuario"("id") on delete set null,
  "inspeccionId" text references public."Inspeccion"("id") on delete set null,
  "cotizacionId" text references public."Cotizacion"("id") on delete set null,
  "entidad" text not null,
  "entidadId" text,
  "accion" text not null,
  "origen" text not null default 'SISTEMA',
  "motivo" text,
  "valorAnterior" jsonb,
  "valorNuevo" jsonb,
  "metadatos" jsonb,
  "ip" text,
  "navegador" text,
  "creadoEn" timestamptz not null default now()
);

create index if not exists "HistorialCambioSistema_usuarioId_idx"
  on public."HistorialCambioSistema"("usuarioId");
create index if not exists "HistorialCambioSistema_inspeccionId_idx"
  on public."HistorialCambioSistema"("inspeccionId");
create index if not exists "HistorialCambioSistema_cotizacionId_idx"
  on public."HistorialCambioSistema"("cotizacionId");
create index if not exists "HistorialCambioSistema_entidad_entidadId_idx"
  on public."HistorialCambioSistema"("entidad", "entidadId");
create index if not exists "HistorialCambioSistema_creadoEn_idx"
  on public."HistorialCambioSistema"("creadoEn");

alter table public."HistorialCambioSistema" enable row level security;

-- No se crean políticas directas para anon/authenticated. El acceso inicial es server-side.

create or replace function public.bloquear_modificacion_historial_cambios()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  raise exception using
    message = 'El historial de cambios es inmutable y no admite UPDATE ni DELETE.',
    errcode = '55000';
end;
$function$;

drop trigger if exists "trg_historial_cambio_inmutable_update" on public."HistorialCambioSistema";
create trigger "trg_historial_cambio_inmutable_update"
before update on public."HistorialCambioSistema"
for each row execute function public.bloquear_modificacion_historial_cambios();

drop trigger if exists "trg_historial_cambio_inmutable_delete" on public."HistorialCambioSistema";
create trigger "trg_historial_cambio_inmutable_delete"
before delete on public."HistorialCambioSistema"
for each row execute function public.bloquear_modificacion_historial_cambios();
