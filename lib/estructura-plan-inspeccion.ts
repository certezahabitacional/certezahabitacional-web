// Pure model shared by preparation, field navigation and regression tests.
export type ConceptoPlan = { nombre: string; aplica: boolean; adicional?: boolean; motivoNoAplica?: string };
export type SubpartidaPlan = { nombre: string; conceptos: ConceptoPlan[] };
export type PartidaPlan = { orden: number; nombre: string; subpartidas: SubpartidaPlan[] };
export type AreaPlan = { id: string; codigo: string; nombre: string; estado: string; resultado: string | null };
export type ItemPlan = { id: string; areaId: string | null; concepto: string; estadoV3: string };
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("es-MX");
export function codigoAreaPlan(orden: number, indice: number) {
  return `PLAN_${String(orden).padStart(2, "0")}_${String(indice + 1).padStart(2, "0")}`;
}
export function validarEstructuraPlan(valor: unknown): PartidaPlan[] {
  if (!Array.isArray(valor) || !valor.length) throw new Error("El plan no contiene partidas.");
  const ordenes = new Set<number>(), nombresAreas = new Set<string>();
  for (const p of valor) {
    if (!p || !Number.isInteger(p.orden) || p.orden < 1 || ordenes.has(p.orden) ||
        typeof p.nombre !== "string" || !p.nombre.trim() || !Array.isArray(p.subpartidas) || !p.subpartidas.length) {
      throw new Error("El plan contiene partidas vacías, repetidas o inválidas.");
    }
    ordenes.add(p.orden);
    for (const sub of p.subpartidas) {
      if (!sub || typeof sub.nombre !== "string" || !sub.nombre.trim() || nombresAreas.has(normalizar(sub.nombre)) ||
          !Array.isArray(sub.conceptos) || !sub.conceptos.length) throw new Error("Cada subpartida debe ser única y contener conceptos.");
      nombresAreas.add(normalizar(sub.nombre));
      const nombres = new Set<string>();
      for (const c of sub.conceptos) {
        if (!c || typeof c.nombre !== "string" || !c.nombre.trim() || nombres.has(normalizar(c.nombre)) || typeof c.aplica !== "boolean") {
          throw new Error("El plan contiene conceptos vacíos, repetidos o sin aplicabilidad.");
        }
        nombres.add(normalizar(c.nombre));
      }
    }
  }
  return [...valor as PartidaPlan[]].sort((a,b) => a.orden-b.orden);
}
export function agruparRecorridoPlan(plan: PartidaPlan[], areas: AreaPlan[], items: ItemPlan[]) {
  const usadas = new Set<string>();
  const partidas = plan.map(p => ({ ...p, subpartidas: p.subpartidas.map((sub, i) => {
    const codigo = codigoAreaPlan(p.orden, i);
    const coincidencias = areas.filter(a => a.codigo === codigo && a.nombre === sub.nombre);
    if (coincidencias.length !== 1) throw new Error(`Falta vincular correctamente ${p.nombre} / ${sub.nombre}.`);
    const area = coincidencias[0]; usadas.add(area.id);
    const conceptos = items.filter(g => g.areaId === area.id);
    for (const c of sub.conceptos) {
      if (conceptos.filter(g => g.concepto === c.nombre).length !== 1) throw new Error(`Falta o se repite un concepto en ${sub.nombre}: ${c.nombre}.`);
    }
    const resueltos = conceptos.filter(g => ["REVISADO","CON_HALLAZGO","NO_APLICA"].includes(g.estadoV3)).length;
    const cerrada = area.estado === "REVISADA" && ["SIN_HALLAZGOS","CON_HALLAZGOS","NO_APLICA"].includes(area.resultado ?? "") && resueltos === conceptos.length;
    return { ...sub, area, items: conceptos, resueltos, cerrada };
  }) }));
  if (areas.some(a => !usadas.has(a.id)) || items.some(g => !g.areaId || !usadas.has(g.areaId))) {
    throw new Error("El recorrido tiene áreas o conceptos fuera del plan confirmado.");
  }
  return partidas;
}
