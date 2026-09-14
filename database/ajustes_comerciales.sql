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
  "aplicadoPorId" text references public."Usuario"("id") on delete set null,
  "aplicadoEn" timestamptz,
  "versionCotizacionOrigen" integer,
  "versionCotizacionAplicada" integer,
  "creadoEn" timestamptz not null default now()
);

alter table public."AjusteComercial"
  add column if not exists "aplicadoPorId" text references public."Usuario"("id") on delete set null,
  add column if not exists "aplicadoEn" timestamptz,
  add column if not exists "versionCotizacionAplicada" integer;

create index if not exists "AjusteComercial_cotizacionId_idx" on public."AjusteComercial"("cotizacionId");
create index if not exists "AjusteComercial_inspeccionId_idx" on public."AjusteComercial"("inspeccionId");
create index if not exists "AjusteComercial_estado_idx" on public."AjusteComercial"("estado");
create index if not exists "AjusteComercial_propuestoPorId_idx" on public."AjusteComercial"("propuestoPorId");
create index if not exists "AjusteComercial_autorizadoPorId_idx" on public."AjusteComercial"("autorizadoPorId");
create index if not exists "AjusteComercial_rechazadoPorId_idx" on public."AjusteComercial"("rechazadoPorId");
create index if not exists "AjusteComercial_aplicadoPorId_idx" on public."AjusteComercial"("aplicadoPorId");
create index if not exists "AjusteComercial_aplicadoEn_idx" on public."AjusteComercial"("aplicadoEn");

alter table public."AjusteComercial" enable row level security;

-- Reglas de negocio:
-- 1. Todo descuento requiere autorización de DIRECCION.
-- 2. Un cargo puede proponerse desde pre-cotización o durante la inspección.
-- 3. AUTORIZAR y APLICAR son momentos distintos. Durante campo, un ajuste autorizado no debe bloquear la captura del Inspector.
-- 4. Si requiere aceptación del cliente, el ajuste solo se aplica al total después de dicha aceptación.
-- 5. Al aplicarse, genera nueva versión comercial y actualiza cargosExtra/descuento/subtotal/total sin borrar pagos históricos.
-- 6. Si el nuevo total genera saldo pendiente, el certificado permanece bloqueado hasta liquidación.
-- 7. Todo ajuste PENDIENTE o AUTORIZADO sin aplicar bloquea la liberación del certificado.
-- 8. Toda creación, autorización, rechazo, aceptación y aplicación debe acompañarse de HistorialCambioSistema y EventoAuditoria.
