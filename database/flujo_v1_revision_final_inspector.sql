-- Flujo V1: revisión final del Inspector antes de Dirección.
-- Columnas aditivas y reversibles; no cambian estados históricos.

alter table "InspeccionControlV2"
  add column if not exists "inspeccionTecnicaConcluidaEn" timestamptz,
  add column if not exists "inspeccionTecnicaConcluidaPorId" text,
  add column if not exists "revisionInspectorFinalEn" timestamptz,
  add column if not exists "revisionInspectorFinalPorId" text;

create index if not exists "InspeccionControlV2_revisionInspectorFinalEn_idx"
  on "InspeccionControlV2" ("revisionInspectorFinalEn");

create index if not exists "InspeccionControlV2_inspeccionTecnicaConcluidaEn_idx"
  on "InspeccionControlV2" ("inspeccionTecnicaConcluidaEn");
