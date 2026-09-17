export type CodigoConceptoProyectoV1 =
  | "ARQUITECTONICO"
  | "ACABADOS"
  | "HIDRAULICA"
  | "SANITARIA"
  | "ELECTRICA"
  | "GAS"
  | "PUERTAS_VENTANAS";

export type ConceptoProyectoV1 = {
  codigo: CodigoConceptoProyectoV1;
  etiqueta: string;
  descripcion: string;
  tiposProyecto: string[];
  gruposPlantilla: string[];
};

export const CONCEPTOS_PROYECTO_V1: ConceptoProyectoV1[] = [
  {
    codigo: "ARQUITECTONICO",
    etiqueta: "Arquitectura y dimensiones",
    descripcion: "Distribución, dimensiones, niveles, vanos, escaleras y elementos arquitectónicos verificables.",
    tiposProyecto: ["ARQUITECTONICO", "FACHADAS"],
    gruposPlantilla: ["GEOMETRIA", "VANOS", "ESCALERA", "SEGURIDAD_FISICA", "EXTERIOR"],
  },
  {
    codigo: "ACABADOS",
    etiqueta: "Acabados",
    descripcion: "Pisos, muros, plafones, pintura, recubrimientos, sellados y acabados especificados.",
    tiposProyecto: ["ACABADOS"],
    gruposPlantilla: ["ACABADOS", "PISOS", "SELLADOS", "ZONA_HUMEDA"],
  },
  {
    codigo: "HIDRAULICA",
    etiqueta: "Instalación hidráulica",
    descripcion: "Alimentación de agua, tomas, muebles y elementos visibles relacionados con la instalación hidráulica.",
    tiposProyecto: ["HIDRAULICA"],
    gruposPlantilla: ["INSTALACIONES_VISIBLES", "COCINA", "BANO", "ZONA_HUMEDA"],
  },
  {
    codigo: "SANITARIA",
    etiqueta: "Instalación sanitaria",
    descripcion: "Descargas, coladeras, muebles sanitarios, pendientes y elementos visibles de drenaje sanitario.",
    tiposProyecto: ["SANITARIA"],
    gruposPlantilla: ["INSTALACIONES_VISIBLES", "BANO", "ZONA_HUMEDA"],
  },
  {
    codigo: "ELECTRICA",
    etiqueta: "Instalación eléctrica",
    descripcion: "Ubicación y correspondencia de elementos eléctricos visibles y sus interferencias con el proyecto.",
    tiposProyecto: ["ELECTRICA", "VOZ_DATOS"],
    gruposPlantilla: ["INSTALACIONES_VISIBLES"],
  },
  {
    codigo: "GAS",
    etiqueta: "Instalación de gas",
    descripcion: "Ubicación y correspondencia de elementos visibles de la instalación de gas.",
    tiposProyecto: ["GAS"],
    gruposPlantilla: ["INSTALACIONES_VISIBLES", "COCINA"],
  },
  {
    codigo: "PUERTAS_VENTANAS",
    etiqueta: "Puertas y ventanas",
    descripcion: "Vanos, puertas, ventanas, cancelería, carpintería fija y funcionamiento asociado.",
    tiposProyecto: ["PUERTAS_VENTANAS"],
    gruposPlantilla: ["VANOS", "CARPINTERIA", "CANCELERIA"],
  },
];

export type AreaProyectoV1Ligera = {
  nombre: string;
  nivel?: string | null;
  ubicacion?: string | null;
  dimensiones?: unknown[];
  especificaciones?: string[];
};

export type AreaCorrelacionadaProyectoV1 = {
  clave: string;
  nombre: string;
  enProyecto: boolean;
  enPlantilla: boolean;
  nombresProyecto: string[];
  nombresPlantilla: string[];
  nivel: string | null;
  ubicacion: string | null;
  dimensiones: unknown[];
  especificaciones: string[];
};

function limpiar(valor: unknown) {
  return String(valor ?? "").trim();
}

export function normalizarProyectoV1(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
}

function numeroArea(valor: string) {
  const normal = normalizarProyectoV1(valor);
  const numero = normal.match(/(?:^|_)(\d{1,2})(?:_|$)/)?.[1];
  if (numero) return numero;
  if (normal.includes("PRINCIPAL")) return "1";
  if (normal.includes("SECUNDARIA")) return "2";
  return "";
}

export function claveAreaProyectoV1(nombre: string) {
  const normal = normalizarProyectoV1(nombre);
  const numero = numeroArea(nombre);
  const sufijo = numero ? `_${numero}` : "";

  if (/(RECAMARA|DORMITORIO|HABITACION)/.test(normal)) return `RECAMARA${sufijo}`;
  if (/(BANO|SANITARIO|WC)/.test(normal)) return `BANO${sufijo}`;
  if (/COCINA/.test(normal)) return "COCINA";
  if (/COMEDOR/.test(normal)) return "COMEDOR";
  if (/(SALA|LIVING)/.test(normal)) return "SALA";
  if (/(ESTANCIA|FAMILY)/.test(normal)) return "ESTANCIA";
  if (/(AREA_DE_LAVADO|AREA_LAVADO|LAVANDERIA)/.test(normal)) return "AREA_LAVADO";
  if (/LAVADERO/.test(normal)) return "LAVADERO";
  if (/(COCHERA|GARAGE|ESTACIONAMIENTO)/.test(normal)) return "COCHERA";
  if (/PATIO/.test(normal)) return "PATIO";
  if (/JARDIN/.test(normal)) return "JARDIN";
  if (/TERRAZA/.test(normal)) return "TERRAZA";
  if (/BALCON/.test(normal)) return "BALCON";
  if (/SOTANO/.test(normal)) return "SOTANO";
  if (/(CUARTO_DE_SERVICIO|CUARTO_SERVICIO)/.test(normal)) return "CUARTO_SERVICIO";
  if (/BODEGA/.test(normal)) return "BODEGA";
  if (/FACHADA/.test(normal)) return "FACHADA_PRINCIPAL";
  if (/ESCALERA/.test(normal)) return "ESCALERA";
  if (/PASILLO/.test(normal)) return `PASILLO${sufijo}`;
  if (/VESTIBULO/.test(normal)) return `VESTIBULO${sufijo}`;
  if (/AZOTEA/.test(normal)) return "AZOTEA";
  return normal || "AREA_SIN_NOMBRE";
}

function entero(valor: unknown) {
  const numero = Number.parseInt(limpiar(valor), 10);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

function booleano(valor: unknown) {
  if (valor === true) return true;
  return ["TRUE", "SI", "SÍ", "1", "YES"].includes(limpiar(valor).toUpperCase());
}

export function areasDeclaradasDesdeSnapshotProyectoV1(snapshot: Record<string, unknown>) {
  const resultado: string[] = [];
  const pares: Array<[string, string]> = [
    ["cocina", "Cocina"],
    ["sala", "Sala"],
    ["comedor", "Comedor"],
    ["estancia", "Estancia"],
    ["areaLavado", "Área de lavado"],
    ["lavadero", "Lavadero"],
    ["cochera", "Cochera"],
    ["patio", "Patio"],
    ["jardin", "Jardín"],
    ["terraza", "Terraza"],
    ["balcon", "Balcón"],
    ["sotano", "Sótano"],
    ["cuartoServicio", "Cuarto de servicio"],
    ["bodega", "Bodega"],
  ];

  for (const [campo, etiqueta] of pares) {
    if (booleano(snapshot[campo])) resultado.push(etiqueta);
  }

  const recamaras = entero(snapshot.recamaras);
  for (let i = 1; i <= recamaras; i += 1) resultado.push(`Recámara ${i}`);

  const banos = entero(snapshot.banos);
  for (let i = 1; i <= banos; i += 1) resultado.push(`Baño ${i}`);

  const otros = limpiar(snapshot.otrosEspacios);
  if (otros) {
    for (const espacio of otros.split(/[;,\n]+/).map((item) => item.trim()).filter(Boolean)) {
      resultado.push(espacio);
    }
  }

  return Array.from(new Set(resultado));
}

export function correlacionarAreasProyectoV1(
  snapshot: Record<string, unknown>,
  areasProyecto: AreaProyectoV1Ligera[],
): AreaCorrelacionadaProyectoV1[] {
  const mapa = new Map<string, AreaCorrelacionadaProyectoV1>();

  for (const nombre of areasDeclaradasDesdeSnapshotProyectoV1(snapshot)) {
    const clave = claveAreaProyectoV1(nombre);
    const fila = mapa.get(clave) ?? {
      clave,
      nombre,
      enProyecto: false,
      enPlantilla: false,
      nombresProyecto: [],
      nombresPlantilla: [],
      nivel: null,
      ubicacion: null,
      dimensiones: [],
      especificaciones: [],
    };
    fila.enPlantilla = true;
    if (!fila.nombresPlantilla.includes(nombre)) fila.nombresPlantilla.push(nombre);
    mapa.set(clave, fila);
  }

  for (const area of areasProyecto) {
    const nombre = limpiar(area.nombre) || "Área detectada en proyecto";
    const clave = claveAreaProyectoV1(nombre);
    const fila = mapa.get(clave) ?? {
      clave,
      nombre,
      enProyecto: false,
      enPlantilla: false,
      nombresProyecto: [],
      nombresPlantilla: [],
      nivel: null,
      ubicacion: null,
      dimensiones: [],
      especificaciones: [],
    };
    fila.enProyecto = true;
    if (!fila.nombresProyecto.includes(nombre)) fila.nombresProyecto.push(nombre);
    fila.nombre = fila.enPlantilla ? fila.nombre : nombre;
    fila.nivel = fila.nivel ?? (area.nivel ? limpiar(area.nivel) : null);
    fila.ubicacion = fila.ubicacion ?? (area.ubicacion ? limpiar(area.ubicacion) : null);
    fila.dimensiones = [...fila.dimensiones, ...(Array.isArray(area.dimensiones) ? area.dimensiones : [])];
    fila.especificaciones = Array.from(new Set([
      ...fila.especificaciones,
      ...(Array.isArray(area.especificaciones) ? area.especificaciones.map(limpiar).filter(Boolean) : []),
    ]));
    mapa.set(clave, fila);
  }

  return Array.from(mapa.values()).sort((a, b) => {
    if (a.clave === "FACHADA_PRINCIPAL") return -1;
    if (b.clave === "FACHADA_PRINCIPAL") return 1;
    if (a.enProyecto !== b.enProyecto) return a.enProyecto ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

export function conceptoMatrizDesdeTipoProyecto(tipo: string): CodigoConceptoProyectoV1 | null {
  const normal = normalizarProyectoV1(tipo);
  const concepto = CONCEPTOS_PROYECTO_V1.find((item) => item.tiposProyecto.includes(normal));
  return concepto?.codigo ?? null;
}
