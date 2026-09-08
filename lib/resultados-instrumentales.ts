import {
  esCodigoHerramienta,
  type ResultadosInstrumentales,
} from "@/lib/herramientas-inspeccion";

const MARCADOR_INICIO = "[[CH_RESULTADOS_INSTRUMENTALES_V1:";
const MARCADOR_FIN = "]]";

export function extraerResultadosInstrumentales(valor?: string | null) {
  const original = valor ?? "";
  const inicio = original.indexOf(MARCADOR_INICIO);

  if (inicio < 0) {
    return {
      resultados: {} as ResultadosInstrumentales,
      textoLibre: original.trim(),
    };
  }

  const inicioJson = inicio + MARCADOR_INICIO.length;
  const fin = original.indexOf(MARCADOR_FIN, inicioJson);

  if (fin < 0) {
    return {
      resultados: {} as ResultadosInstrumentales,
      textoLibre: original.trim(),
    };
  }

  const resultados: ResultadosInstrumentales = {};

  try {
    const parsed = JSON.parse(original.slice(inicioJson, fin)) as Record<
      string,
      unknown
    >;

    for (const [codigo, valorResultado] of Object.entries(parsed)) {
      if (
        !esCodigoHerramienta(codigo) ||
        !valorResultado ||
        typeof valorResultado !== "object"
      ) {
        continue;
      }

      const item = valorResultado as Record<string, unknown>;
      const valoresRaw =
        item.valores && typeof item.valores === "object"
          ? (item.valores as Record<string, unknown>)
          : {};

      resultados[codigo] = {
        estado:
          item.estado === "NO_EJECUTADA"
            ? "NO_EJECUTADA"
            : "REALIZADA",
        valores: Object.fromEntries(
          Object.entries(valoresRaw).map(([clave, contenido]) => [
            clave,
            String(contenido ?? "").trim(),
          ]),
        ),
        motivoNoEjecutada:
          typeof item.motivoNoEjecutada === "string"
            ? item.motivoNoEjecutada.trim()
            : undefined,
      };
    }
  } catch {
    // Si el marcador está dañado se conserva el texto libre y no se inventan resultados.
  }

  const textoLibre = `${original.slice(0, inicio)}${original.slice(
    fin + MARCADOR_FIN.length,
  )}`.trim();

  return { resultados, textoLibre };
}

export function serializarResultadosInstrumentales(
  resultados: ResultadosInstrumentales,
  textoLibre = "",
) {
  const texto = textoLibre.trim();
  const json = JSON.stringify(resultados);

  return `${MARCADOR_INICIO}${json}${MARCADOR_FIN}${
    texto ? `\n${texto}` : ""
  }`;
}
