export const HERRAMIENTAS_INSPECCION = [
  {
    codigo: "CAMARA_TERMICA",
    nombre: "Cámara térmica",
    aplicacionCotizacion:
      "Humedad aparente, anomalías térmicas, aislamiento, posibles fugas y calentamientos eléctricos.",
    efectoReporte:
      "Documenta únicamente las anomalías térmicas relevantes observadas durante la inspección, su ubicación y la evidencia obtenida.",
    campos: [
      { clave: "ubicacion", etiqueta: "Área / ubicación", tipo: "text" },
      { clave: "resultado", etiqueta: "Resultado / observación térmica", tipo: "textarea" },
    ],
  },
  {
    codigo: "PROBADOR_GFCI_RCD",
    nombre: "Probador de contactos GFCI/RCD",
    aplicacionCotizacion:
      "Polaridad, tierra, conexiones incorrectas y funcionamiento de protección.",
    efectoReporte:
      "Registra los puntos relevantes verificados y cualquier condición anómala de polaridad, tierra o protección GFCI/RCD.",
    campos: [
      { clave: "puntos", etiqueta: "Puntos verificados / ubicación", tipo: "text" },
      { clave: "resultado", etiqueta: "Resultado", tipo: "textarea" },
    ],
  },
  {
    codigo: "DETECTOR_VOLTAJE",
    nombre: "Detector de voltaje sin contacto",
    aplicacionCotizacion: "Presencia de tensión eléctrica.",
    efectoReporte:
      "Registra únicamente condiciones relevantes asociadas con presencia o ausencia inesperada de tensión.",
    campos: [
      { clave: "ubicacion", etiqueta: "Punto / ubicación", tipo: "text" },
      { clave: "resultado", etiqueta: "Resultado", tipo: "textarea" },
    ],
  },
  {
    codigo: "MULTIMETRO",
    nombre: "Multímetro profesional",
    aplicacionCotizacion: "Voltaje, continuidad y verificaciones eléctricas específicas.",
    efectoReporte:
      "Incorpora las lecturas eléctricas relevantes obtenidas y su interpretación dentro del alcance de la inspección.",
    campos: [
      { clave: "ubicacion", etiqueta: "Punto / ubicación", tipo: "text" },
      { clave: "lecturas", etiqueta: "Lecturas obtenidas", tipo: "textarea" },
      { clave: "resultado", etiqueta: "Conclusión / observación", tipo: "textarea" },
    ],
  },
  {
    codigo: "NIVEL_LASER",
    nombre: "Nivel láser autonivelante",
    aplicacionCotizacion: "Desniveles y desviaciones importantes.",
    efectoReporte:
      "Registra las zonas medidas y los desniveles o desviaciones relevantes identificados.",
    campos: [
      { clave: "ubicacion", etiqueta: "Zona medida", tipo: "text" },
      { clave: "mediciones", etiqueta: "Mediciones / desviación", tipo: "textarea" },
      { clave: "resultado", etiqueta: "Conclusión", tipo: "textarea" },
    ],
  },
  {
    codigo: "MEDIDOR_LASER",
    nombre: "Medidor láser de distancia",
    aplicacionCotizacion: "Dimensiones y comprobaciones rápidas.",
    efectoReporte:
      "Incorpora únicamente las dimensiones que resulten relevantes para documentar el alcance o un hallazgo.",
    campos: [
      { clave: "ubicacion", etiqueta: "Área / elemento", tipo: "text" },
      { clave: "mediciones", etiqueta: "Dimensiones relevantes", tipo: "textarea" },
    ],
  },
  {
    codigo: "AUSCULTACION_PISOS",
    nombre: "Martillo / rodillo de auscultación",
    aplicacionCotizacion: "Losetas con indicios de huecos o desprendimiento.",
    efectoReporte:
      "Registra las áreas auscultadas y los indicios relevantes de huecos, desprendimiento o piezas sueltas.",
    campos: [
      { clave: "ubicacion", etiqueta: "Área auscultada", tipo: "text" },
      { clave: "resultado", etiqueta: "Resultado / extensión aproximada", tipo: "textarea" },
    ],
  },
  {
    codigo: "LINTERNA",
    nombre: "Linterna LED profesional",
    aplicacionCotizacion: "Inspección visual detallada.",
    efectoReporte:
      "Funciona como apoyo de la inspección visual y de la evidencia fotográfica; solo se documentan condiciones relevantes encontradas.",
    campos: [
      { clave: "resultado", etiqueta: "Observaciones relevantes", tipo: "textarea" },
    ],
  },
  {
    codigo: "MANOMETRO_AGUA",
    nombre: "Manómetro para agua",
    aplicacionCotizacion: "Presión de suministro hidráulico.",
    efectoReporte:
      "Registra el punto de prueba, la presión observada y la conclusión correspondiente.",
    campos: [
      { clave: "ubicacion", etiqueta: "Punto de prueba", tipo: "text" },
      { clave: "presion", etiqueta: "Presión observada", tipo: "text" },
      { clave: "resultado", etiqueta: "Conclusión", tipo: "textarea" },
    ],
  },
  {
    codigo: "DETECTOR_GAS",
    nombre: "Detector de gas combustible",
    aplicacionCotizacion: "Indicios de fugas en instalaciones de gas.",
    efectoReporte:
      "Registra los puntos revisados, el resultado de la detección y cualquier indicio relevante de presencia de gas combustible.",
    campos: [
      { clave: "ubicacion", etiqueta: "Puntos / ubicación", tipo: "text" },
      { clave: "resultado", etiqueta: "Resultado de detección", tipo: "textarea" },
    ],
  },
  {
    codigo: "HERMETICIDAD_HIDRAULICA",
    nombre: "Prueba de hermeticidad hidráulica",
    aplicacionCotizacion:
      "Verificación de pérdida de presión cuando el sistema y las condiciones de seguridad lo permitan.",
    efectoReporte:
      "Registra condiciones de prueba, presión inicial, presión final, duración y resultado de la verificación hidráulica.",
    campos: [
      { clave: "puntoPrueba", etiqueta: "Punto / condiciones de prueba", tipo: "text" },
      { clave: "presionInicial", etiqueta: "Presión inicial", tipo: "text" },
      { clave: "presionFinal", etiqueta: "Presión final", tipo: "text" },
      { clave: "duracion", etiqueta: "Duración de la prueba", tipo: "text" },
      { clave: "resultado", etiqueta: "Resultado / conclusión", tipo: "textarea" },
    ],
  },
  {
    codigo: "HERMETICIDAD_GAS",
    nombre: "Prueba de hermeticidad de gas",
    aplicacionCotizacion:
      "Verificación de estanqueidad cuando la instalación y las condiciones de seguridad lo permitan.",
    efectoReporte:
      "Registra condiciones de prueba, lectura o presión inicial, lectura o presión final, duración y resultado de la verificación de estanqueidad.",
    campos: [
      { clave: "puntoPrueba", etiqueta: "Punto / condiciones de prueba", tipo: "text" },
      { clave: "lecturaInicial", etiqueta: "Lectura / presión inicial", tipo: "text" },
      { clave: "lecturaFinal", etiqueta: "Lectura / presión final", tipo: "text" },
      { clave: "duracion", etiqueta: "Duración de la prueba", tipo: "text" },
      { clave: "resultado", etiqueta: "Resultado / conclusión", tipo: "textarea" },
    ],
  },
] as const;

export type CodigoHerramienta =
  (typeof HERRAMIENTAS_INSPECCION)[number]["codigo"];

export type EstadoResultadoInstrumental =
  | "REALIZADA"
  | "NO_EJECUTADA";

export type ResultadoHerramienta = {
  estado: EstadoResultadoInstrumental;
  valores: Record<string, string>;
  motivoNoEjecutada?: string;
};

export type ResultadosInstrumentales = Partial<
  Record<CodigoHerramienta, ResultadoHerramienta>
>;

export const HERRAMIENTAS_PRESELECCIONADAS: CodigoHerramienta[] =
  HERRAMIENTAS_INSPECCION.map((herramienta) => herramienta.codigo);

const MARCADOR_INICIO = "[[CH_HERRAMIENTAS_V1:";
const MARCADOR_FIN = "]]";

export function esCodigoHerramienta(valor: string): valor is CodigoHerramienta {
  return HERRAMIENTAS_INSPECCION.some(
    (herramienta) => herramienta.codigo === valor,
  );
}

export function normalizarHerramientas(
  codigos: readonly string[] | null | undefined,
): CodigoHerramienta[] {
  const unicos = new Set<CodigoHerramienta>();

  for (const codigo of codigos ?? []) {
    if (esCodigoHerramienta(codigo)) unicos.add(codigo);
  }

  return HERRAMIENTAS_INSPECCION
    .map((herramienta) => herramienta.codigo)
    .filter((codigo) => unicos.has(codigo));
}

export function obtenerHerramientas(codigos: readonly string[]) {
  const validos = new Set(normalizarHerramientas(codigos));
  return HERRAMIENTAS_INSPECCION.filter((herramienta) =>
    validos.has(herramienta.codigo),
  );
}

export function serializarConfiguracionHerramientas(
  codigos: readonly string[],
  textoLibre = "",
) {
  const configuracion = JSON.stringify(normalizarHerramientas(codigos));
  const texto = textoLibre.trim();
  return `${MARCADOR_INICIO}${configuracion}${MARCADOR_FIN}${
    texto ? `\n${texto}` : ""
  }`;
}

export function extraerConfiguracionHerramientas(valor?: string | null) {
  const original = valor ?? "";
  const inicio = original.indexOf(MARCADOR_INICIO);

  if (inicio < 0) {
    return {
      herramientas: [] as CodigoHerramienta[],
      textoLibre: original.trim(),
    };
  }

  const inicioJson = inicio + MARCADOR_INICIO.length;
  const fin = original.indexOf(MARCADOR_FIN, inicioJson);

  if (fin < 0) {
    return {
      herramientas: [] as CodigoHerramienta[],
      textoLibre: original.trim(),
    };
  }

  let herramientas: CodigoHerramienta[] = [];

  try {
    const parsed = JSON.parse(original.slice(inicioJson, fin));
    if (Array.isArray(parsed)) {
      herramientas = normalizarHerramientas(
        parsed.filter((item): item is string => typeof item === "string"),
      );
    }
  } catch {
    herramientas = [];
  }

  const textoLibre = `${original.slice(0, inicio)}${original.slice(fin + MARCADOR_FIN.length)}`.trim();

  return { herramientas, textoLibre };
}

export function parsearResultadosInstrumentales(
  descripcion?: string | null,
): ResultadosInstrumentales {
  if (!descripcion) return {};

  try {
    const parsed = JSON.parse(descripcion) as Record<string, unknown>;
    const resultados: ResultadosInstrumentales = {};

    for (const [codigo, valor] of Object.entries(parsed)) {
      if (!esCodigoHerramienta(codigo) || !valor || typeof valor !== "object") {
        continue;
      }

      const item = valor as Record<string, unknown>;
      const estado =
        item.estado === "NO_EJECUTADA" ? "NO_EJECUTADA" : "REALIZADA";
      const valoresRaw =
        item.valores && typeof item.valores === "object"
          ? (item.valores as Record<string, unknown>)
          : {};
      const valores = Object.fromEntries(
        Object.entries(valoresRaw).map(([clave, contenido]) => [
          clave,
          String(contenido ?? "").trim(),
        ]),
      );

      resultados[codigo] = {
        estado,
        valores,
        motivoNoEjecutada:
          typeof item.motivoNoEjecutada === "string"
            ? item.motivoNoEjecutada.trim()
            : undefined,
      };
    }

    return resultados;
  } catch {
    return {};
  }
}
