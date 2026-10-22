export const healthSnapshot = {
  statusDate: "2026-10-06",
  score: 82,
  status: "ACEPTABLE CON OBSERVACIONES",
  dimensions: [
    ["Alcance", 90, "VERDE", "Línea base y EDT aprobadas."],
    ["Cronograma", 88, "VERDE", "Sin retraso crítico proyectado antes del arranque."],
    ["Costos", 92, "VERDE", "Sin sobrecosto proyectado; EAC igual al BAC."],
    ["Riesgos", 72, "AMARILLO", "Existen riesgos altos y medios que requieren seguimiento."],
    ["Calidad", 84, "VERDE", "Controles iniciales definidos; proyecto aún sin ejecución."],
    ["Recursos y suministros", 66, "AMARILLO", "Existen restricciones y decisiones pendientes asociadas a suministros y recursos críticos."],
  ],
  alerts: [
    ["ALTA","Licencia y permisos iniciales","DEC-001 · RST-1 · R-002","2026-10-26","Definir estrategia y liberar permiso antes del arranque."],
    ["ALTA","Acero estructural","DEC-005 · R-001 · R-003","2026-10-28","Autorizar estrategia de suministro y proteger la fabricación."],
    ["ALTA","Planos de taller de estructura","RST-2","2026-11-30","Aprobar planos o definir correcciones requeridas."],
    ["ALTA","Panel/lámina de cubierta","DEC-017 · R-003","2026-11-30","Autorizar alternativa de suministro antes de afectar la envolvente."],
    ["ALTA","Grúa de montaje","DEC-003 · RST-3","2026-12-20","Formalizar contratación y fecha de movilización."],
  ],
} as const;
