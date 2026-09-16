import { HERRAMIENTAS_INSPECCION, type CodigoHerramienta } from "@/lib/herramientas-inspeccion";

export const TECNOLOGIA_BASE_CERTEZA = {
  codigo: "APP_CERTEZA",
  nombre: "Aplicación Certeza Habitacional",
  funcion:
    "Guía digital del proceso de inspección, control de alcance, captura de evidencia, trazabilidad, asistencia de IA, seguimiento y preparación automatizada del reporte.",
  aplicacion:
    "Se utiliza durante toda la V1 para relacionar cotización, áreas, puntos mínimos, proyectos, procesos, evidencia, hallazgos, resultados instrumentales, firmas y cierre de campo.",
  ventaja:
    "Reduce omisiones y tiempos de captura, conserva la trazabilidad técnica y permite transformar la evidencia de campo en un reporte consistente, visual y fácil de interpretar.",
} as const;

const VENTAJAS: Partial<Record<CodigoHerramienta, string>> = {
  CAMARA_TERMICA: "Permite complementar la inspección visual con patrones térmicos que pueden revelar condiciones no evidentes a simple vista.",
  PROBADOR_GFCI_RCD: "Agiliza la verificación de polaridad, tierra y protecciones en contactos compatibles.",
  DETECTOR_VOLTAJE: "Permite una comprobación rápida de presencia de tensión sin contacto directo con conductores.",
  MULTIMETRO: "Aporta lecturas eléctricas cuantitativas para sustentar verificaciones específicas.",
  NIVEL_LASER: "Facilita comprobaciones consistentes de nivelación, alineación y desviaciones en diferentes puntos.",
  MEDIDOR_LASER: "Reduce el tiempo de medición y permite documentar dimensiones con rapidez y repetibilidad.",
  AUSCULTACION_PISOS: "Ayuda a identificar indicios de piezas huecas, desprendidas o con adherencia deficiente.",
  LINTERNA: "Mejora la visibilidad de detalles y condiciones en zonas con iluminación insuficiente.",
  MANOMETRO_AGUA: "Permite documentar presión de suministro y comportamiento hidráulico con una lectura objetiva.",
  DETECTOR_GAS: "Complementa la revisión de gas al detectar indicios de presencia de gas combustible en puntos revisados.",
  HERMETICIDAD_HIDRAULICA: "Permite observar variaciones de presión durante un periodo controlado de prueba.",
  HERMETICIDAD_GAS: "Permite documentar el comportamiento de la instalación durante una prueba controlada de estanqueidad.",
};

export function fichaHerramientaReporte(codigo: CodigoHerramienta) {
  const herramienta = HERRAMIENTAS_INSPECCION.find((h) => h.codigo === codigo);
  if (!herramienta) return null;
  return {
    codigo: herramienta.codigo,
    nombre: herramienta.nombre,
    funcion: herramienta.aplicacionCotizacion,
    aplicacion: herramienta.efectoReporte,
    ventaja: VENTAJAS[codigo] ?? "Complementa el criterio profesional del Inspector con evidencia o mediciones específicas.",
  };
}
