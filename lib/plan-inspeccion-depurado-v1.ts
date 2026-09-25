export type PerfilInspeccionV1 = "NUEVA" | "USADA";

export type PrioridadPlanV1 = "OBLIGATORIO" | "RECOMENDADO" | "CONDICIONAL";

export type PuntoBibliotecaPlan = {
  codigo: string;
  concepto: string;
  especificacion: string | null;
  grupo: string | null;
  herramienta: string | null;
  orden: number;
};

export type PuntoMaestroPlan = {
  codigo: string;
  nombre: string;
  descripcion: string;
  prioridad: PrioridadPlanV1;
  seleccionado: boolean;
  subcriterios: PuntoBibliotecaPlan[];
};

type ReglaMaestra = {
  codigo: string;
  nombre: string;
  descripcion: string;
  codigos: string[];
  prioridadNueva: PrioridadPlanV1;
  prioridadUsada: PrioridadPlanV1;
  seleccionarNueva: boolean;
  seleccionarUsada: boolean;
};

const REGLAS_MAESTRAS: ReglaMaestra[] = [
  {
    codigo: "GEOMETRIA_GENERAL",
    nombre: "Geometría general del espacio",
    descripcion: "Integra dimensiones, nivel, plomo y escuadras. En vivienda usada se propone solo cuando el servicio, el proyecto o una condición visible justifiquen medir.",
    codigos: ["DIM_LARGO","DIM_ANCHO","DIM_ALTURA","NIVELES","DESPLOMES","ESCUADRAS"],
    prioridadNueva: "RECOMENDADO",
    prioridadUsada: "CONDICIONAL",
    seleccionarNueva: true,
    seleccionarUsada: false,
  },
  {
    codigo: "MUROS_ACABADOS",
    nombre: "Muros y acabados",
    descripcion: "Integra condición general, fisuras visibles, desprendimientos, textura, pintura, tono, remates y homogeneidad.",
    codigos: ["MUROS_ESTADO","MUROS_ACABADO","ACABADO_UNIFORMIDAD","PINTURA"],
    prioridadNueva: "RECOMENDADO",
    prioridadUsada: "RECOMENDADO",
    seleccionarNueva: true,
    seleccionarUsada: true,
  },
  {
    codigo: "PLAFON_LOSA_INTERIOR",
    nombre: "Plafón / losa interior",
    descripcion: "Integra condición, fisuras, deformaciones, humedad, nivelación, juntas, pintura y uniformidad.",
    codigos: ["PLAFON_LOSA","PLAFON_NIVELACION"],
    prioridadNueva: "RECOMENDADO",
    prioridadUsada: "RECOMENDADO",
    seleccionarNueva: true,
    seleccionarUsada: true,
  },
  {
    codigo: "PISO_COMPLETO",
    nombre: "Piso: condición, planeidad y adherencia",
    descripcion: "Integra daños, manchas, juntas, cejas, nivelación, transiciones y auscultación de recubrimientos cuando aplique.",
    codigos: ["PISO_ESTADO","PISO_NIVELACION","PISO_CERAMICO"],
    prioridadNueva: "RECOMENDADO",
    prioridadUsada: "RECOMENDADO",
    seleccionarNueva: true,
    seleccionarUsada: true,
  },
  {
    codigo: "PUERTAS_COMPLETO",
    nombre: "Puertas: instalación, funcionamiento y sellos",
    descripcion: "Integra vano, plomo, nivel, fijación, holguras, apertura, cierre, herrajes, cerraduras, sellos y remates.",
    codigos: ["VANO_PUERTA","PUERTA_INSTALACION","PUERTA_FUNCION","SELLADO_PUERTA"],
    prioridadNueva: "RECOMENDADO",
    prioridadUsada: "RECOMENDADO",
    seleccionarNueva: true,
    seleccionarUsada: true,
  },
  {
    codigo: "VENTANAS_COMPLETO",
    nombre: "Ventanas: instalación, funcionamiento y sellos",
    descripcion: "Integra vano, plomo, nivel, fijación, vidrio, apertura, cierre, seguros, sellado y encuentros.",
    codigos: ["VANO_VENTANA","VENTANA_INSTALACION","VENTANA_FUNCION","SELLADO_VENTANA"],
    prioridadNueva: "RECOMENDADO",
    prioridadUsada: "RECOMENDADO",
    seleccionarNueva: true,
    seleccionarUsada: true,
  },
  {
    codigo: "INSTALACIONES_VISIBLES",
    nombre: "Instalaciones visibles",
    descripcion: "Integra ubicación, altura, alineación, fijación, placas, tapas, remates e interferencias visibles.",
    codigos: ["INST_UBICACION","INST_ALTURA","INST_ALINEACION","INST_INTERFERENCIAS"],
    prioridadNueva: "RECOMENDADO",
    prioridadUsada: "RECOMENDADO",
    seleccionarNueva: true,
    seleccionarUsada: true,
  },
  {
    codigo: "HUMEDAD_CONDICION",
    nombre: "Humedad, manchas y condición anormal",
    descripcion: "Busca indicios visibles de humedad y habilita medición instrumental cuando exista una señal o el perfil del inmueble lo justifique.",
    codigos: ["HUMEDAD_VISIBLE"],
    prioridadNueva: "CONDICIONAL",
    prioridadUsada: "OBLIGATORIO",
    seleccionarNueva: true,
    seleccionarUsada: true,
  },
];

function prioridadEspecial(codigo: string, perfil: PerfilInspeccionV1): PrioridadPlanV1 {
  const obligatoriosUsada = new Set([
    "MUEBLES_SANITARIOS","COLADERAS","PENDIENTES_HUMEDAS","TARJA",
    "BARANDAL","PENDIENTES_EXTERIOR","IMPERMEABILIZACION_VISIBLE",
  ]);
  const recomendadosNueva = new Set([
    "MUEBLES_SANITARIOS","COLADERAS","PENDIENTES_HUMEDAS","ANTIDERRAPANTE",
    "CANCEL_BANO","LAMBRIN","MUEBLES_COCINA","CUBIERTA_COCINA","TARJA",
    "CLOSET_CARPINTERIA","BARANDAL","PENDIENTES_EXTERIOR","IMPERMEABILIZACION_VISIBLE",
    "FACHADA_JUNTAS","FACHADA_MOLDURAS","FACHADA_RECUBRIMIENTO","FACHADA_RODAPIE",
  ]);
  if (perfil === "USADA" && obligatoriosUsada.has(codigo)) return "OBLIGATORIO";
  if (perfil === "NUEVA" && recomendadosNueva.has(codigo)) return "RECOMENDADO";
  return "CONDICIONAL";
}

export function agruparPuntosMaestrosV1(
  puntos: PuntoBibliotecaPlan[],
  perfil: PerfilInspeccionV1,
): PuntoMaestroPlan[] {
  const consumidos = new Set<string>();
  const maestros: PuntoMaestroPlan[] = [];

  for (const regla of REGLAS_MAESTRAS) {
    const subcriterios = puntos.filter((p) => regla.codigos.includes(p.codigo));
    if (!subcriterios.length) continue;
    subcriterios.forEach((p) => consumidos.add(p.codigo));
    maestros.push({
      codigo: regla.codigo,
      nombre: regla.nombre,
      descripcion: regla.descripcion,
      prioridad: perfil === "NUEVA" ? regla.prioridadNueva : regla.prioridadUsada,
      seleccionado: perfil === "NUEVA" ? regla.seleccionarNueva : regla.seleccionarUsada,
      subcriterios,
    });
  }

  for (const punto of puntos) {
    if (consumidos.has(punto.codigo)) continue;
    const prioridad = prioridadEspecial(punto.codigo, perfil);
    maestros.push({
      codigo: punto.codigo,
      nombre: punto.concepto,
      descripcion: punto.especificacion ?? "Criterio específico de la Biblioteca Certeza.",
      prioridad,
      seleccionado: prioridad !== "CONDICIONAL",
      subcriterios: [punto],
    });
  }

  return maestros.sort((a, b) => {
    const oa = Math.min(...a.subcriterios.map((p) => p.orden));
    const ob = Math.min(...b.subcriterios.map((p) => p.orden));
    return oa - ob || a.nombre.localeCompare(b.nombre, "es");
  });
}

export function estimarMinutosPlanV1(totalPuntosMaestros: number, totalCriticos: number) {
  // Meta de campo: 2–3 horas. Los puntos maestros están diseñados para resolverse
  // rápidamente con SH / Hallazgo / No aplica y profundización solo cuando sea necesaria.
  const base = 25;
  const minutosMaestros = totalPuntosMaestros * 1.15;
  const minutosCriticos = totalCriticos * 2.2;
  return Math.round(base + minutosMaestros + minutosCriticos);
}


export function codigoMaestroParaPuntoV1(codigo: string) {
  const regla = REGLAS_MAESTRAS.find((item) => item.codigos.includes(codigo));
  return regla?.codigo ?? codigo;
}
