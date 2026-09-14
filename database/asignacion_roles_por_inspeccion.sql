-- Certeza Habitacional · asignación operativa por inspección
-- Inspector, Coordinador y Gerente quedan vinculados a cada inspección concreta.
-- La jerarquía permanente Usuario.gerenteId / Usuario.coordinadorId deja de gobernar el acceso técnico.

create table if not exists public."AsignacionRolInspeccion" (
  "id" uuid primary key default gen_random_uuid(),
  "inspeccionId" text not null references public."Inspeccion"("id") on delete cascade,
  "usuarioId" text not null references public."Usuario"("id") on delete cascade,
  "rol" text not null check ("rol" in ('GERENTE','COORDINADOR','INSPECTOR')),
  "creadoEn" timestamptz not null default now(),
  unique ("inspeccionId", "rol")
);

create index if not exists "AsignacionRolInspeccion_usuarioId_rol_idx"
  on public."AsignacionRolInspeccion"("usuarioId", "rol");
create index if not exists "AsignacionRolInspeccion_inspeccionId_idx"
  on public."AsignacionRolInspeccion"("inspeccionId");

alter table public."AsignacionRolInspeccion" enable row level security;

-- Preserva la jerarquía histórica como asignación de cada inspección antes de
-- retirar los vínculos permanentes del Usuario.
insert into public."AsignacionRolInspeccion" ("inspeccionId", "usuarioId", "rol")
select i."id", u."gerenteId", 'GERENTE'
from public."Inspeccion" i
join public."Inspector" insp on insp."id" = i."inspectorId"
join public."Usuario" u on u."id" = insp."usuarioId"
where u."gerenteId" is not null
on conflict ("inspeccionId", "rol") do nothing;

insert into public."AsignacionRolInspeccion" ("inspeccionId", "usuarioId", "rol")
select i."id", u."coordinadorId", 'COORDINADOR'
from public."Inspeccion" i
join public."Inspector" insp on insp."id" = i."inspectorId"
join public."Usuario" u on u."id" = insp."usuarioId"
where u."coordinadorId" is not null
on conflict ("inspeccionId", "rol") do nothing;

insert into public."AsignacionRolInspeccion" ("inspeccionId", "usuarioId", "rol")
select i."id", insp."usuarioId", 'INSPECTOR'
from public."Inspeccion" i
join public."Inspector" insp on insp."id" = i."inspectorId"
where i."inspectorId" is not null
on conflict ("inspeccionId", "rol") do update
set "usuarioId" = excluded."usuarioId";

create or replace function public.sincronizar_asignacion_inspector_inspeccion()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  delete from public."AsignacionRolInspeccion"
  where "inspeccionId" = new."id" and "rol" = 'INSPECTOR';

  if new."inspectorId" is not null then
    insert into public."AsignacionRolInspeccion" ("inspeccionId", "usuarioId", "rol")
    select new."id", i."usuarioId", 'INSPECTOR'
    from public."Inspector" i
    where i."id" = new."inspectorId"
    on conflict ("inspeccionId", "rol") do update
    set "usuarioId" = excluded."usuarioId";
  end if;

  return new;
end;
$function$;

drop trigger if exists "trg_sincronizar_asignacion_inspector_inspeccion"
  on public."Inspeccion";
create trigger "trg_sincronizar_asignacion_inspector_inspeccion"
after insert or update of "inspectorId" on public."Inspeccion"
for each row execute function public.sincronizar_asignacion_inspector_inspeccion();

-- A partir de aquí Coordinadores e Inspectores ya no dependen de una jerarquía
-- permanente. Sus relaciones operativas se resuelven por AsignacionRolInspeccion.
update public."Usuario"
set "gerenteId" = null,
    "coordinadorId" = null
where "rol" in ('COORDINADOR', 'INSPECTOR')
  and ("gerenteId" is not null or "coordinadorId" is not null);
