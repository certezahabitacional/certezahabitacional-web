import { readFileSync } from "fs";
import path from "path";
import { deflateRawSync, inflateRawSync } from "zlib";

type DatosCotizacionWord = {
  folio: string;
  fecha: string;
  vigenciaDias: number;
  cliente: string;
  telefono: string;
  correo: string;
  tipoCliente: string;
  direccion: string;
  ciudad: string;
  terrenoM2: string;
  construccionM2: string;
  niveles: string;
  recamaras: string;
  banos: string;
  espacios: string[];
  otrosEspacios: string;
  comentarios: string;
  total: number;
  pago50: number;
};

type ZipEntry = {
  name: string;
  data: Buffer;
};

const TABLA_CRC32 = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = TABLA_CRC32[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encontrarEocd(buffer: Buffer) {
  const minimo = Math.max(0, buffer.length - 0xffff - 22);
  for (let i = buffer.length - 22; i >= minimo; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error("Plantilla DOCX inválida: no se encontró EOCD.");
}

function descomprimirZip(buffer: Buffer): ZipEntry[] {
  const eocd = encontrarEocd(buffer);
  const totalEntradas = buffer.readUInt16LE(eocd + 10);
  let posicion = buffer.readUInt32LE(eocd + 16);
  const entradas: ZipEntry[] = [];

  for (let i = 0; i < totalEntradas; i += 1) {
    if (buffer.readUInt32LE(posicion) !== 0x02014b50) {
      throw new Error("Plantilla DOCX inválida: directorio central corrupto.");
    }

    const metodo = buffer.readUInt16LE(posicion + 10);
    const tamanoComprimido = buffer.readUInt32LE(posicion + 20);
    const tamanoOriginal = buffer.readUInt32LE(posicion + 24);
    const largoNombre = buffer.readUInt16LE(posicion + 28);
    const largoExtra = buffer.readUInt16LE(posicion + 30);
    const largoComentario = buffer.readUInt16LE(posicion + 32);
    const offsetLocal = buffer.readUInt32LE(posicion + 42);
    const nombre = buffer
      .subarray(posicion + 46, posicion + 46 + largoNombre)
      .toString("utf8");

    if (buffer.readUInt32LE(offsetLocal) !== 0x04034b50) {
      throw new Error(`Plantilla DOCX inválida: entrada local ${nombre}.`);
    }

    const largoNombreLocal = buffer.readUInt16LE(offsetLocal + 26);
    const largoExtraLocal = buffer.readUInt16LE(offsetLocal + 28);
    const inicioDatos = offsetLocal + 30 + largoNombreLocal + largoExtraLocal;
    const comprimido = buffer.subarray(
      inicioDatos,
      inicioDatos + tamanoComprimido,
    );

    let data: Buffer;
    if (metodo === 0) {
      data = Buffer.from(comprimido);
    } else if (metodo === 8) {
      data = inflateRawSync(comprimido);
    } else {
      throw new Error(`Método ZIP no soportado en ${nombre}: ${metodo}.`);
    }

    if (data.length !== tamanoOriginal) {
      throw new Error(`Plantilla DOCX inválida: tamaño incorrecto en ${nombre}.`);
    }

    entradas.push({ name: nombre, data });
    posicion += 46 + largoNombre + largoExtra + largoComentario;
  }

  return entradas;
}

function comprimirZip(entradas: ZipEntry[]) {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let offset = 0;

  for (const entrada of entradas) {
    const nombre = Buffer.from(entrada.name, "utf8");
    const data = Buffer.from(entrada.data);
    const comprimido = deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nombre.length, 26);

    const bloqueLocal = Buffer.concat([local, nombre, comprimido]);
    locales.push(bloqueLocal);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt32LE(offset, 42);

    centrales.push(Buffer.concat([central, nombre]));
    offset += bloqueLocal.length;
  }

  const directorioCentral = Buffer.concat(centrales);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entradas.length, 8);
  eocd.writeUInt16LE(entradas.length, 10);
  eocd.writeUInt32LE(directorioCentral.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locales, directorioCentral, eocd]);
}

function escaparXml(valor: string | number | null | undefined) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function dinero(valor: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(valor);
}

function textoBanos(valor: string) {
  const numero = Number(String(valor).replace(",", "."));
  if (!Number.isFinite(numero)) return valor;

  const completos = Math.floor(numero);
  const medios = numero - completos >= 0.5 ? 1 : 0;
  const partes: string[] = [];

  if (completos > 0) {
    partes.push(
      `${completos} baño${completos === 1 ? "" : "s"} completo${
        completos === 1 ? "" : "s"
      }`,
    );
  }
  if (medios > 0) partes.push("1 medio baño");

  return partes.length ? partes.join(" + ") : "No indicado";
}

function cargarPlantillaBase() {
  const partes = [0, 1, 2, 3, 4].map((indice) => {
    const ruta = path.join(
      process.cwd(),
      "lib",
      `plantilla-cotizacion-ch-f-002.part${indice}.b64`,
    );
    return readFileSync(ruta, "utf8").trim();
  });

  const base64 = partes.join("");
  const plantilla = Buffer.from(base64, "base64");

  // Un DOCX válido es un ZIP y debe contener el registro EOCD.
  encontrarEocd(plantilla);
  return plantilla;
}

export function crearCotizacionWordEditable(data: DatosCotizacionWord) {
  const plantilla = cargarPlantillaBase();
  const entradas = descomprimirZip(plantilla);

  const otrosEspacios = data.otrosEspacios.trim()
    ? data.otrosEspacios.trim()
    : "No se declararon otros espacios o características.";
  const comentarios = data.comentarios.trim()
    ? data.comentarios.trim()
    : "Sin comentarios adicionales.";

  const reemplazos: Record<string, string> = {
    FOLIO: data.folio,
    FECHA: data.fecha,
    NOMBRE_CLIENTE: data.cliente,
    TELEFONO: data.telefono,
    CORREO: data.correo,
    TIPO_CLIENTE: data.tipoCliente,
    DIRECCION_INMUEBLE: data.direccion,
    CIUDAD_INMUEBLE: data.ciudad,
    M2_TERRENO: data.terrenoM2,
    M2_CONSTRUCCION: data.construccionM2,
    DISTRIBUCION: `${data.niveles} niveles · ${data.recamaras} recámaras · ${textoBanos(
      data.banos,
    )}`,
    AREAS_DECLARADAS: data.espacios.length
      ? data.espacios.join(" · ")
      : "No se declararon áreas adicionales.",
    OTROS_ESPACIOS: otrosEspacios,
    COMENTARIOS: comentarios,
    TOTAL: dinero(data.total),
    MITAD: dinero(data.pago50),
  };

  for (const entrada of entradas) {
    if (!entrada.name.endsWith(".xml")) continue;

    let xml = entrada.data.toString("utf8");
    for (const [clave, valor] of Object.entries(reemplazos)) {
      xml = xml.replaceAll(`{{${clave}}}`, escaparXml(valor));
    }

    if (entrada.name === "word/footer1.xml") {
      xml = xml.replace(
        /Monte Apeninos 6436, Col\. La Cuesta, [^<]*/,
        "Monte Apeninos 6436, Col. La Cuesta, Ciudad Juárez, Chihuahua",
      );
    }

    entrada.data = Buffer.from(xml, "utf8");
  }

  return comprimirZip(entradas);
}
