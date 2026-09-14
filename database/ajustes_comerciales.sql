-- Certeza Habitacional · Ajustes comerciales trazables
-- Cargos adicionales y descuentos desde pre-cotización o durante inspección.
-- Aplicar primero en DEV.

create table if not exists public."AjusteComercial" (
  "id" uuid primary key default gen_random_uuid(),
  "cotizacionId" text not null references public."Cotizacion"("id") on delete cascade,
  "inspeccionId" text references public."Inspeccion"("id") on delete set null,
  "tipo" text not null check ("tipo" in ('CARGO','DESCUENTO')),
  "origen" text not null check ("origen" in ('PRE_COTIZACION','INSPECCION','SOLICITUD_CLIENTE','OTRO')),
  "concepto" text not null,
  "motivo" text not null,
  "monto" numeric(12,2) not null check ("monto" > 0),
  "estado" text not null default 'PENDIENTE' check ("estado" in ('PENDIENTE','AUTORIZADO','RECHAZADO','CANCELADO')),
  "propuestoPorId" text references public."Usuario"("id") on delete set null,
  "propuestoEn" timestamptz not null default now(),
  "autorizadoPorId" text references public."Usuario"("id") on delete set null,
  "autorizadoEn" timestamptz,
  "rechazadoPorId" text references public."Usuario"("id") on delete set null,
  "rechazadoEn" timestamptz,
  "motivoResolucion" text,
  "requiereAceptacionCliente" boolean not null default false,
  "aceptadoCliente" boolean not null default false,
  "aceptadoClienteEn" timestamptz,
  "versionCotizacionOrigen" integer,
  "creadoEn" timestamptz not null default now()
);

create index if not exists "AjusteComercial_cotizacionId_idx" on public."AjusteComercial"("cotizacionId");
create index if not exists "AjusteComercial_inspeccionId_idx" on public."AjusteComercial"("inspeccionId");
create index if not exists "AjusteComercial_estado_idx" on public."AjusteComercial"("estado");
create index if not exists "AjusteComercial_propuestoPorId_idx" on public."AjusteComercial"("propuestoPorId");
create index if not exists "AjusteComercial_autorizadoPorId_idx" on public."AjusteComercial"("autorizadoPorId");

alter table public."AjusteComercial" enable row level security;

-- Reglas de negocio previstas:
-- 1. Todo descuento requiere autorización de DIRECCION.
-- 2. Un cargo puede proponerse desde pre-cotización o durante la inspección.
-- 3. Un ajuste autorizado genera nueva versión comercial de la cotización.
-- 4. Los pagos ya realizados nunca se borran ni se recalculan históricamente.
-- 5. Si un cargo autorizado genera saldo, el certificado permanece bloqueado hasta liquidación.
-- 6. Si un ajuste modifica una condición ya aceptada por el cliente, debe marcar requiereAceptacionCliente=true.
-- 7. Toda creación/resolución debe acompañarse de HistorialCambioSistema y EventoAuditoria.
