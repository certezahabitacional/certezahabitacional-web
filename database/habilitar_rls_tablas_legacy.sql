-- Certeza Habitacional · endurecimiento de tablas legacy expuestas por PostgREST
-- La aplicación accede a estas tablas desde servidor/Prisma; no requieren acceso directo anon/authenticated.

alter table public."PlantillaInspeccion" enable row level security;
alter table public."CotizacionVersion" enable row level security;
alter table public."PagoCotizacion" enable row level security;
alter table public."ObservacionAgenda" enable row level security;
alter table public."PagoComision" enable row level security;
