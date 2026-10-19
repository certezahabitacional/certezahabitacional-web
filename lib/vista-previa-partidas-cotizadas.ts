import { CATALOGO_16_PARTIDAS } from "@/lib/catalogo-16-partidas";

type DatosCotizacion = Record<string, unknown>;

function numero(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  if (typeof valor === "string" && valor.trim() && Number.isFinite(Number(valor))) return Number(valor);
  return null;
}

// No se descartan partidas declaradas: ante datos ambiguos se ofrece el catálogo
// completo para revisión posterior. Esta vista no modifica el expediente.
export function vistaPreviaPartidasCotizadas(datos: DatosCotizacion) {
  const habitaciones = numero(datos.recamaras);
  const banos = numero(datos.banos);
  const niveles = numero(datos.niveles);
  return CATALOGO_16_PARTIDAS.filter((partida) => {
    const n = partida.nombre;
    const recamara = /^Recámara ([123])$/.exec(n);
    if (recamara && habitaciones !== null) return habitaciones >= Number(recamara[1]);
    if (n === "Baño completo 1" && banos !== null) return banos >= 1;
    if (n === "Baño completo 2" && banos !== null) return banos >= 2;
    if (n === "Medio baño" && banos !== null) return banos % 1 >= 0.49;
    if ((n === "Escalera a planta alta" || n === "Distribuidor de planta alta") && niveles !== null) return niveles >= 2;
    const presencia: Record<string, string> = {
      Sala: "sala", Comedor: "comedor", Cocina: "cocina",
      "Área de lavado": "areaLavado",
    };
    const campo = presencia[n];
    if (campo && datos[campo] === false) return false;
    return true;
  });
}
