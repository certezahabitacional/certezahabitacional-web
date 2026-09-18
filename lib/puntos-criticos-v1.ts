import type { CodigoHerramienta } from "@/lib/herramientas-inspeccion";

export type CodigoPuntoCriticoV1 =
  | "HIDRAULICA"
  | "SANITARIA"
  | "PLUVIAL"
  | "GAS"
  | "DUCTOS"
  | "ELECTRICA"
  | "LOSAS_AZOTEA";

export type ItemPlantillaPuntoCriticoV1 = {
  codigo: string;
  nombre: string;
  descripcion: string;
  herramientaSugerida: string | null;
  requiereMedicion: boolean;
  requiereComparacionProyecto: boolean;
  requiereCuatroFotos: boolean;
  requiereHerramientasCotizadas?: CodigoHerramienta[];
};

export type PuntoCriticoV1 = {
  codigo: CodigoPuntoCriticoV1;
  etiqueta: string;
  descripcion: string;
  tiposProyecto: string[];
  palabrasClave: string[];
  herramientasRelacionadas: CodigoHerramienta[];
  herramientasPruebaProlongada: CodigoHerramienta[];
  plantilla: ItemPlantillaPuntoCriticoV1[];
};

const item = (
  codigo: string,
  nombre: string,
  descripcion: string,
  herramientaSugerida: string | null = null,
  requiereMedicion = false,
  requiereComparacionProyecto = false,
  requiereCuatroFotos = true,
  requiereHerramientasCotizadas?: CodigoHerramienta[],
): ItemPlantillaPuntoCriticoV1 => ({
  codigo,
  nombre,
  descripcion,
  herramientaSugerida,
  requiereMedicion,
  requiereComparacionProyecto,
  requiereCuatroFotos,
  requiereHerramientasCotizadas,
});

export const PUNTOS_CRITICOS_V1: PuntoCriticoV1[] = [
  {
    codigo: "HIDRAULICA",
    etiqueta: "INSTALACIÓN HIDRÁULICA",
    descripcion: "Presión, hermeticidad, fugas, válvulas, soportes y salidas visibles.",
    tiposProyecto: ["HIDRAULICA"],
    palabrasClave: ["HIDRAUL", "AGUA POTABLE", "TOMA DE AGUA", "ALIMENTACION DE AGUA"],
    herramientasRelacionadas: ["MANOMETRO_AGUA", "HERMETICIDAD_HIDRAULICA", "MEDIDOR_LASER", "CAMARA_TERMICA"],
    herramientasPruebaProlongada: ["HERMETICIDAD_HIDRAULICA"],
    plantilla: [
      item("PC_HID_01_MANOMETRO", "Fotografía del manómetro al iniciar", "Cuando la cotización incluya manómetro o prueba de hermeticidad, la primera evidencia debe mostrar manómetro, escala y lectura inicial.", "Manómetro / cámara", true, false, true, ["MANOMETRO_AGUA", "HERMETICIDAD_HIDRAULICA"]),
      item("PC_HID_02_LECTURA_FINAL", "Lectura final de presión", "Registrar lectura final y tiempo transcurrido al cierre de la prueba de hermeticidad.", "Manómetro / cronómetro", true, true, true, ["HERMETICIDAD_HIDRAULICA"]),
      item("PC_HID_03_FUGAS", "Fugas visibles", "Revisar uniones, válvulas, conexiones y puntos accesibles en busca de fuga o humedad.", "Detector de humedad / inspección visual"),
      item("PC_HID_04_VALVULAS", "Válvulas y elementos de control", "Verificar presencia, accesibilidad, fijación y condición aparente.", "Inspección visual", false, true),
      item("PC_HID_05_SOPORTES", "Trazo, soportes y protección", "Revisar recorrido visible, soportes, pasos, protección e interferencias.", "Inspección visual / medidor láser", false, true),
      item("PC_HID_06_SALIDAS", "Ubicación de salidas hidráulicas", "Verificar ubicación, altura, alineación y fijación de salidas visibles.", "Medidor láser / nivel", true, true),
    ],
  },
  {
    codigo: "SANITARIA",
    etiqueta: "INSTALACIÓN SANITARIA",
    descripcion: "Descargas, ventilación, registros, coladeras, pendientes y fugas.",
    tiposProyecto: ["SANITARIA"],
    palabrasClave: ["SANITAR", "DRENAJE", "DESCARGA", "COLADERA", "VENTILA"],
    herramientasRelacionadas: ["NIVEL_LASER", "MEDIDOR_LASER", "CAMARA_TERMICA"],
    herramientasPruebaProlongada: [],
    plantilla: [
      item("PC_SAN_01_PRUEBA", "Evidencia inicial del método de prueba", "Documentar el método de prueba disponible y su montaje cuando corresponda.", "Cámara / instrumento aplicable"),
      item("PC_SAN_02_DESCARGAS", "Descargas y conexiones visibles", "Revisar uniones, cambios de dirección, desacoples o daños.", "Inspección visual", false, true),
      item("PC_SAN_03_PENDIENTES", "Pendientes verificables", "Medir pendientes accesibles y comparar contra proyecto cuando exista.", "Nivel digital / nivel láser", true, true),
      item("PC_SAN_04_COLADERAS", "Coladeras y puntos de desalojo", "Verificar ubicación, nivel, remates, fijación y comportamiento de desalojo.", "Nivel / prueba con agua", false, true),
      item("PC_SAN_05_REGISTROS", "Registros y accesibilidad", "Confirmar accesibilidad, tapas, remates y condición aparente.", "Inspección visual", false, true),
      item("PC_SAN_06_VENTILACION", "Ventilación sanitaria", "Revisar recorrido y terminaciones accesibles.", "Inspección visual", false, true),
      item("PC_SAN_07_FUGAS", "Fugas, humedad u olores anormales", "Registrar evidencia física observable sin afirmar causas no comprobadas.", "Detector de humedad / inspección visual"),
    ],
  },
  {
    codigo: "PLUVIAL",
    etiqueta: "INSTALACIÓN PLUVIAL",
    descripcion: "Captación, pendientes, bajantes, canalones y descarga.",
    tiposProyecto: ["PLUVIAL"],
    palabrasClave: ["PLUVIAL", "BAJANTE", "AGUA DE LLUVIA", "CANALON"],
    herramientasRelacionadas: ["NIVEL_LASER", "MEDIDOR_LASER", "CAMARA_TERMICA"],
    herramientasPruebaProlongada: [],
    plantilla: [
      item("PC_PLU_01_CAPTACION", "Captación y puntos de entrada", "Revisar coladeras, canalones, bocas y obstrucciones.", "Inspección visual", false, true),
      item("PC_PLU_02_PENDIENTES", "Pendientes y puntos bajos", "Verificar dirección de pendientes y zonas de encharcamiento.", "Nivel digital / prueba con agua", true, true),
      item("PC_PLU_03_BAJANTES", "Bajantes y uniones", "Revisar continuidad, fijación, juntas y daños.", "Inspección visual", false, true),
      item("PC_PLU_04_DESCARGA", "Punto final de descarga", "Verificar correspondencia con proyecto y afectaciones visibles.", "Inspección visual", false, true),
      item("PC_PLU_05_FUGAS", "Fugas durante escurrimiento", "Cuando sea posible realizar prueba funcional, revisar fugas.", "Prueba con agua / inspección visual"),
      item("PC_PLU_06_INTERFERENCIAS", "Interferencias y accesibilidad", "Revisar cruces con otros sistemas y acceso de mantenimiento.", "Inspección visual", false, true),
    ],
  },
  {
    codigo: "GAS",
    etiqueta: "INSTALACIÓN DE GAS",
    descripcion: "Hermeticidad, presión, válvulas, reguladores, soportes y conexiones visibles.",
    tiposProyecto: ["GAS"],
    palabrasClave: ["GAS", "REGULADOR", "VALVULA DE GAS"],
    herramientasRelacionadas: ["DETECTOR_GAS", "HERMETICIDAD_GAS", "MEDIDOR_LASER"],
    herramientasPruebaProlongada: ["HERMETICIDAD_GAS"],
    plantilla: [
      item("PC_GAS_01_MANOMETRO", "Fotografía del manómetro al iniciar", "Cuando la cotización incluya prueba de hermeticidad, la primera evidencia debe mostrar manómetro, escala y lectura inicial.", "Manómetro / cámara", true, false, true, ["HERMETICIDAD_GAS"]),
      item("PC_GAS_02_LECTURA_FINAL", "Lectura final de presión", "Registrar lectura final y tiempo transcurrido al cierre de la prueba.", "Manómetro / cronómetro", true, true, true, ["HERMETICIDAD_GAS"]),
      item("PC_GAS_03_FUGAS", "Indicios de fuga", "Revisar conexiones con el procedimiento seguro permitido; no realizar maniobras no autorizadas.", "Detector de gas combustible"),
      item("PC_GAS_04_VALVULAS", "Válvulas y regulador", "Verificar presencia, accesibilidad, fijación y condición.", "Inspección visual", false, true),
      item("PC_GAS_05_SOPORTES", "Soportes, protección y recorrido", "Revisar sujeción, protección e interferencias.", "Inspección visual / medidor láser", false, true),
      item("PC_GAS_06_EQUIPOS", "Conexión visible a equipos", "Revisar conexión, válvula de corte y ubicación.", "Inspección visual", false, true),
    ],
  },
  {
    codigo: "DUCTOS",
    etiqueta: "INSTALACIÓN DE DUCTOS",
    descripcion: "Trazos, uniones, soportes, aislamiento, salidas y flujo.",
    tiposProyecto: ["DUCTOS", "AIRE_ACONDICIONADO"],
    palabrasClave: ["DUCTO", "VENTILACION", "EXTRACCION", "RETORNO"],
    herramientasRelacionadas: ["MEDIDOR_LASER", "CAMARA_TERMICA"],
    herramientasPruebaProlongada: [],
    plantilla: [
      item("PC_DUC_01_TRAZO", "Trazo general", "Comparar recorrido y cambios de dirección contra proyecto.", "Medidor láser / inspección visual", true, true),
      item("PC_DUC_02_UNIONES", "Uniones y sellos", "Revisar continuidad, cierres y sellado aparente.", "Inspección visual"),
      item("PC_DUC_03_SOPORTES", "Soportes y fijaciones", "Revisar estabilidad y condición visible.", "Inspección visual", false, true),
      item("PC_DUC_04_AISLAMIENTO", "Aislamiento", "Revisar continuidad, daños y terminaciones.", "Inspección visual / cámara térmica", false, true),
      item("PC_DUC_05_REJILLAS", "Rejillas, difusores y retornos", "Verificar ubicación, fijación y correspondencia.", "Medidor láser / inspección visual", false, true),
      item("PC_DUC_06_INTERFERENCIAS", "Interferencias y mantenimiento", "Revisar cruces, obstáculos y acceso.", "Inspección visual", false, true),
    ],
  },
  {
    codigo: "ELECTRICA",
    etiqueta: "INSTALACIÓN ELÉCTRICA",
    descripcion: "Tableros, protecciones, voltaje, polaridad, tierra y salidas visibles.",
    tiposProyecto: ["ELECTRICA", "VOZ_DATOS"],
    palabrasClave: ["ELECTRIC", "CONTACTO", "TABLERO", "TIERRA", "APAGADOR"],
    herramientasRelacionadas: ["PROBADOR_GFCI_RCD", "DETECTOR_VOLTAJE", "MULTIMETRO", "CAMARA_TERMICA"],
    herramientasPruebaProlongada: [],
    plantilla: [
      item("PC_ELE_01_TABLERO", "Fotografía general del tablero", "Registrar tablero, identificación y condición general antes de verificaciones permitidas.", "Cámara / inspección visual", false, true),
      item("PC_ELE_02_PROTECCIONES", "Protecciones y circuitos", "Revisar identificación y condición visible sin desmontajes no autorizados.", "Inspección visual", false, true),
      item("PC_ELE_03_VOLTAJE", "Voltaje en puntos permitidos", "Registrar voltaje sólo bajo condiciones seguras.", "Multímetro CAT adecuado", true, true, true, ["MULTIMETRO"]),
      item("PC_ELE_04_POLARIDAD", "Polaridad y tierra verificable", "Verificar con equipo apropiado sin intervenir partes energizadas expuestas.", "Probador GFCI/RCD / multímetro", true, false, true, ["PROBADOR_GFCI_RCD", "MULTIMETRO"]),
      item("PC_ELE_05_CONTACTOS", "Contactos, apagadores y salidas", "Revisar ubicación, fijación, placas y funcionamiento básico.", "Probador / nivel", false, true),
      item("PC_ELE_06_LUMINARIAS", "Luminarias y salidas de iluminación", "Revisar ubicación, fijación y funcionamiento accesible.", "Prueba funcional / inspección visual", false, true),
      item("PC_ELE_07_CONDICION", "Humedad, daños e interferencias", "Registrar cualquier condición visible que requiera atención.", "Inspección visual / cámara térmica"),
    ],
  },
  {
    codigo: "LOSAS_AZOTEA",
    etiqueta: "LOSAS DE AZOTEA",
    descripcion: "Pendientes, impermeabilización, fisuras, penetraciones, pretiles y desalojo.",
    tiposProyecto: ["LOSAS_AZOTEA", "ESTRUCTURAL", "ARQUITECTONICO"],
    palabrasClave: ["AZOTEA", "LOSA", "PRETIL", "IMPERMEABIL", "PENDIENTE"],
    herramientasRelacionadas: ["NIVEL_LASER", "MEDIDOR_LASER", "CAMARA_TERMICA"],
    herramientasPruebaProlongada: [],
    plantilla: [
      item("PC_AZO_01_PANORAMICA", "Fotografía panorámica inicial", "Registrar vista general de la azotea accesible.", "Cámara", false, true),
      item("PC_AZO_02_PENDIENTES", "Pendientes y puntos bajos", "Revisar dirección de pendientes y depresiones.", "Nivel digital / nivel láser", true, true),
      item("PC_AZO_03_IMPERMEABILIZACION", "Impermeabilización", "Revisar continuidad, traslapes, desprendimientos y remates.", "Inspección visual", false, true),
      item("PC_AZO_04_FISURAS", "Fisuras y deformaciones visibles", "Registrar fisuras, grietas o deformaciones que requieran evaluación.", "Fisurómetro / nivel", true, false),
      item("PC_AZO_05_PENETRACIONES", "Penetraciones, bases y sellos", "Revisar encuentros con tuberías, ductos y equipos.", "Inspección visual", false, true),
      item("PC_AZO_06_PRETILES", "Pretiles y encuentros", "Revisar fisuras, coronamientos, sellos y remates.", "Inspección visual / nivel", false, true),
      item("PC_AZO_07_DESALOJO", "Coladeras y bajantes", "Revisar accesibilidad, obstrucciones y remates.", "Prueba con agua / inspección visual", false, true),
      item("PC_AZO_08_HUMEDAD", "Indicios de humedad", "Relacionar manchas o filtraciones con puntos superiores sin afirmar causalidad no comprobada.", "Detector de humedad / cámara térmica", true, false),
    ],
  },
];

export function normalizarTextoPuntoCritico(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function proyectoDisponibleParaPuntoCritico(
  punto: PuntoCriticoV1,
  documentos: Array<{ tipo: string; datosExtraidos: unknown }>,
) {
  return documentos.some((documento) => {
    const tipo = normalizarTextoPuntoCritico(documento.tipo);
    if (punto.tiposProyecto.some((permitido) => tipo === normalizarTextoPuntoCritico(permitido))) return true;
    if (!documento.datosExtraidos) return false;
    const contenido = normalizarTextoPuntoCritico(JSON.stringify(documento.datosExtraidos));
    return punto.palabrasClave.some((palabra) =>
      contenido.includes(normalizarTextoPuntoCritico(palabra)),
    );
  });
}

export function herramientasAplicablesPuntoCritico(
  punto: PuntoCriticoV1,
  herramientasCotizadas: readonly CodigoHerramienta[],
) {
  const seleccionadas = new Set(herramientasCotizadas);
  return punto.herramientasRelacionadas.filter((codigo) => seleccionadas.has(codigo));
}

export function tienePruebaProlongadaCotizada(
  punto: PuntoCriticoV1,
  herramientasCotizadas: readonly CodigoHerramienta[],
) {
  const seleccionadas = new Set(herramientasCotizadas);
  return punto.herramientasPruebaProlongada.some((codigo) => seleccionadas.has(codigo));
}


export function plantillaAplicablePuntoCritico(
  punto: PuntoCriticoV1,
  herramientasCotizadas: readonly CodigoHerramienta[],
) {
  const seleccionadas = new Set(herramientasCotizadas);
  return punto.plantilla.filter((item) =>
    !item.requiereHerramientasCotizadas?.length ||
    item.requiereHerramientasCotizadas.some((codigo) => seleccionadas.has(codigo)),
  );
}
