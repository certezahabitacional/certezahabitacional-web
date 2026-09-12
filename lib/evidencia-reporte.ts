import { prisma } from "@/lib/prisma";

export type SeleccionEvidenciaReporte = {
  id: string;
  fotografiaId: string;
  seleccionada: boolean;
  orden: number;
  notaEditorial: string | null;
};

export type EstadoSeleccionEvidencia = {
  disponible: boolean;
  activa: boolean;
  filas: SeleccionEvidenciaReporte[];
  idsSeleccionados: string[];
  ordenPorFotografia: Map<string, number>;
  notaPorFotografia: Map<string, string | null>;
};

export async function obtenerSeleccionEvidenciaReporte(
  inspeccionId: string,
): Promise<EstadoSeleccionEvidencia> {
  try {
    const tabla = await prisma.$queryRaw<Array<{ tabla: string | null }>>`
      SELECT to_regclass('public."SeleccionEvidenciaReporte"')::text AS "tabla"
    `;

    if (!tabla[0]?.tabla) {
      return {
        disponible: false,
        activa: false,
        filas: [],
        idsSeleccionados: [],
        ordenPorFotografia: new Map(),
        notaPorFotografia: new Map(),
      };
    }

    const filas = await prisma.$queryRaw<SeleccionEvidenciaReporte[]>`
      SELECT "id","fotografiaId","seleccionada","orden","notaEditorial"
      FROM "SeleccionEvidenciaReporte"
      WHERE "inspeccionId"=${inspeccionId}
      ORDER BY "orden" ASC, "actualizadaEn" ASC
    `;

    const seleccionadas = filas
      .filter((fila) => fila.seleccionada)
      .sort((a, b) => a.orden - b.orden);

    return {
      disponible: true,
      // Compatibilidad histórica: la selección sólo se considera activa cuando
      // existe al menos una fotografía seleccionada. Si no hay filas, el reporte
      // puede seguir usando todas las evidencias como hasta ahora.
      activa: seleccionadas.length > 0,
      filas,
      idsSeleccionados: seleccionadas.map((fila) => fila.fotografiaId),
      ordenPorFotografia: new Map(
        seleccionadas.map((fila) => [fila.fotografiaId, fila.orden]),
      ),
      notaPorFotografia: new Map(
        seleccionadas.map((fila) => [fila.fotografiaId, fila.notaEditorial]),
      ),
    };
  } catch {
    return {
      disponible: false,
      activa: false,
      filas: [],
      idsSeleccionados: [],
      ordenPorFotografia: new Map(),
      notaPorFotografia: new Map(),
    };
  }
}

export function ordenarYFiltrarFotografias<T extends { id: string }>(
  fotografias: T[],
  seleccion: EstadoSeleccionEvidencia,
): T[] {
  if (!seleccion.activa) return fotografias;

  const permitidas = new Set(seleccion.idsSeleccionados);
  return fotografias
    .filter((foto) => permitidas.has(foto.id))
    .sort(
      (a, b) =>
        (seleccion.ordenPorFotografia.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (seleccion.ordenPorFotografia.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
}
