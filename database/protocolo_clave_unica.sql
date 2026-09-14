-- Certeza Habitacional · Unicidad de pasos del protocolo V1
-- Garantiza compatibilidad con ON CONFLICT ("inspeccionId","clave")
-- incluso cuando ProtocoloInspeccionPaso ya existía antes del SQL base V2.

create unique index if not exists "ProtocoloInspeccionPaso_inspeccionId_clave_key"
  on public."ProtocoloInspeccionPaso"("inspeccionId", "clave");
