export const risks=[
["R-001","Retraso en acero estructural","MEDIA","ALTO","ALTO","Celedonio Gil Rodríguez","CC-03","ACT-005","MITIGAR","2026-11-30"],
["R-002","Demora en permisos iniciales","BAJA","ALTO","MEDIO","Celedonio Gil Rodríguez","CC-01","ACT-001","MITIGAR","2026-10-26"],
["R-003","Incremento de precios de acero y panel","MEDIA","ALTO","ALTO","Celedonio Gil Rodríguez","CC-03","ACT-005","TRANSFERIR","2026-11-30"],
["R-004","Incidente durante montaje de estructura","BAJA","BAJO","BAJO","Constructora Delta Norte","CC-03","ACT-006","EVITAR","2027-01-04"],
["R-005","Filtraciones en cubierta","BAJA","ALTO","MEDIO","Supervisión Técnica Frontera","CC-04","ACT-007","MITIGAR","2027-01-18"],
["R-006","Retraso de tablero eléctrico principal","BAJA","BAJO","BAJO","Celedonio Gil Rodríguez","CC-05","ACT-008","MITIGAR","2027-02-08"],
] as const;

export const constraints=[
["RST-1","ACT-001","Licencia de construcción pendiente de liberación final","Puede impedir arranque formal","Celedonio Gil Rodríguez","2026-11-02","PENDIENTE"],
["RST-2","ACT-005","Planos de taller de estructura requieren aprobación","Puede afectar fabricación de acero","Ingeniería y Arquitectura Norte","2026-11-30","PENDIENTE"],
["RST-3","ACT-006","Contrato de grúa de montaje no formalizado","Riesgo de indisponibilidad en montaje","Constructora Delta Norte","2026-12-20","PENDIENTE"],
["RST-4","ACT-010","Energía eléctrica definitiva requerida para pruebas","Puede impedir puesta en marcha","Celedonio Gil Rodríguez","2027-05-20","PENDIENTE"],
] as const;

export const decisions=[
["DEC-001","Definir estrategia para liberar licencia y permisos iniciales","2026-10-26","ALTA","PENDIENTE","CC-01","ACT-001","Celedonio Gil Rodríguez","RESTRICCION:RST-1 | RIESGO:R-002 | HITO:HITO-9"],
["DEC-002","Aprobar planos de taller de estructura o definir correcciones requeridas","2026-11-30","ALTA","CERRADO","CC-03","ACT-005","Celedonio Gil Rodríguez","RESTRICCION:RST-2"],
["DEC-003","Autorizar contratación y fecha de movilización de grúa de montaje","2026-12-20","ALTA","PENDIENTE","CC-03","ACT-006","Celedonio Gil Rodríguez","RESTRICCION:RST-3"],
["DEC-004","Definir estrategia para liberar energía eléctrica definitiva para pruebas","2027-05-20","ALTA","PENDIENTE","CC-05","ACT-010","Celedonio Gil Rodríguez","RESTRICCION:RST-4"],
["DEC-005","Autorizar estrategia de suministro y liberación de acero estructural","2026-10-28","ALTA","PENDIENTE","CC-03","ACT-005","Celedonio Gil Rodríguez","SUMINISTRO:SUM-001 | ADQUISICION:ADQ-001 | RIESGO:R-001 | RIESGO:R-003"],
["DEC-007","Autorizar alternativa de suministro para tablero eléctrico principal","2027-01-30","ALTA","PENDIENTE","CC-05","ACT-008","Celedonio Gil Rodríguez","SUMINISTRO:SUM-003 | RIESGO:R-006"],
["DEC-008","Autorizar alternativa de suministro para bomba contra incendio","2027-01-30","ALTA","PENDIENTE","CC-05","ACT-008","Celedonio Gil Rodríguez","SUMINISTRO:SUM-004"],
["DEC-017","Autorizar alternativa de suministro para panel/lámina de cubierta","2026-11-30","ALTA","PENDIENTE","CC-04","ACT-007","Celedonio Gil Rodríguez","SUMINISTRO:SUM-002 | RIESGO:R-003 | HITO:HITO-12"],
] as const;