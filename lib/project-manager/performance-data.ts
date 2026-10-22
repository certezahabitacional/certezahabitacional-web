export const performanceSnapshot = {
  statusDate: "2026-10-06",
  bac: 24600000,
  pv: 0,
  ev: 0,
  ac: 0,
  spi: null as number | null,
  cpi: null as number | null,
  sv: 0,
  cv: 0,
  eac: 24600000,
  etc: 24600000,
  vac: 0,
  forecastFinish: "2027-06-30",
  scheduleVarianceDays: 0,
  healthScore: 82,
  healthStatus: "ACEPTABLE CON OBSERVACIONES",
  physicalProgress: 0,
  financialProgress: 0,
  note: "Estado preoperativo migrado desde Certeza Project Manager v1.9.0. No existe corte EVM porque el proyecto inicia el 02/11/2026.",
} as const;

export function calculateEvm(input: { bac:number; pv:number; ev:number; ac:number }) {
  const { bac, pv, ev, ac } = input;
  const spi = pv > 0 ? ev / pv : null;
  const cpi = ac > 0 ? ev / ac : null;
  const sv = ev - pv;
  const cv = ev - ac;
  let eac: number | null = null;
  if (cpi && cpi > 0) eac = bac / cpi;
  else if (ac === 0 && ev === 0) eac = bac;
  const etc = eac !== null ? Math.max(eac - ac, 0) : null;
  const vac = eac !== null ? bac - eac : null;
  return { spi, cpi, sv, cv, eac, etc, vac };
}

export const productivityState = {
  hasExecutionData: false,
  message: "Todavía no existen registros de producción porque el proyecto no ha iniciado ejecución.",
  plannedStart: "2026-11-02",
  measures: [
    "Cantidad ejecutada por actividad",
    "Horas-hombre reales",
    "HH por unidad",
    "Rendimiento de cuadrilla",
    "Horas improductivas",
    "Horas de retrabajo",
    "Utilización de equipo",
  ],
} as const;
