import { z } from "zod";

import { instalarCompatibilidadOpenAIGateway } from "@/lib/ai-gateway-openai-compat";

instalarCompatibilidadOpenAIGateway();

export const DimensionProyectoV1Schema = z.object({
  nombre: z.string().min(1),
  valor: z.string().min(1),
  unidad: z.string().nullable().optional(),
  referencia: z.string().nullable().optional(),
});

export const ElementoProyectoV1Schema = z.object({
  nombre: z.string().min(1),
  tipo: z.string().nullable().optional(),
  ubicacion: z.string().nullable().optional(),
  especificacion: z.string().nullable().optional(),
  cantidad: z.number().nonnegative().nullable().optional(),
  unidad: z.string().nullable().optional(),
  referencia: z.string().nullable().optional(),
});

export const AreaProyectoV1Schema = z.object({
  nombre: z.string().min(1),
  nivel: z.string().nullable().optional(),
  ubicacion: z.string().nullable().optional(),
  dimensiones: z.array(DimensionProyectoV1Schema).default([]),
  especificaciones: z.array(z.string()).default([]),
  elementos: z.array(ElementoProyectoV1Schema).default([]),
  referencias: z.array(z.string()).default([]),
});

export const ResultadoDocumentoProyectoV1Schema = z.object({
  version: z.literal(1),
  resumen: z.string().default(""),
  tipoProyectoDetectado: z.string().nullable().optional(),
  areas: z.array(AreaProyectoV1Schema).default([]),
  especificacionesGenerales: z.array(z.string()).default([]),
  elementosSinArea: z.array(ElementoProyectoV1Schema).default([]),
  advertencias: z.array(z.string()).default([]),
  referencias: z.array(z.string()).default([]),
});

export type ResultadoDocumentoProyectoV1 = z.infer<typeof ResultadoDocumentoProyectoV1Schema>;

export const ResultadoConsolidadoProyectoV1Schema = z.object({
  version: z.literal(1),
  documentos: z.array(z.object({
    documentoId: z.string().min(1),
    nombreOriginal: z.string().min(1),
    tipo: z.string().min(1),
    resultado: ResultadoDocumentoProyectoV1Schema,
  })),
  areas: z.array(AreaProyectoV1Schema).default([]),
  advertencias: z.array(z.string()).default([]),
});

export type ResultadoConsolidadoProyectoV1 = z.infer<typeof ResultadoConsolidadoProyectoV1Schema>;

/**
 * Contrato independiente del proveedor de IA.
 * Cualquier motor que analice planos V1 debe entregar este JSON y pasar
 * validacion antes de persistir datosExtraidos o enriquecer la guia tecnica.
 */
export function validarResultadoDocumentoProyectoV1(valor: unknown) {
  return ResultadoDocumentoProyectoV1Schema.parse(valor);
}
