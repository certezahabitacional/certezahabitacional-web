import { readFile } from "fs/promises";
import path from "path";

import JSZip from "jszip";
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";

import { obtenerZonaServicio, type ZonaServicio } from "@/lib/configuracion-zonas";

export type DatosDocumentoCotizacion = {
  folio: string;
  fecha: string;
  nombre: string;
  telefono: string;
  correo: string;
  tipoCliente: string;
  zona: ZonaServicio;
  direccionInmueble: string;
  ciudadInmueble: string;
  m2Terreno: string;
  m2Construccion: string;
  niveles: string;
  recamaras: string;
  banos: string;
  espacios: string[];
  otrosEspacios: string;
  comentarios: string;
  totalPropuesto: number;
  pago50: number;
};

const RUTA_DOCX = path.join(
  process.cwd(),
  "public",
  "templates",
  "Cotizacion_Autorizada_Maestra_v2.docx",
);

const RUTA_PDF = path.join(
  process.cwd(),
  "public",
  "templates",
  "Cotizacion_Autorizada_Maestra_v2.pdf",
);

function xmlEscape(valor: string) {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function moneda(valor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  })
    .format(valor)
    .replace("$", "$");
}

function plural(valor: number, singular: string, pluralTexto: string) {
  return `${valor} ${valor === 1 ? singular : pluralTexto}`;
}

function distribucion(datos: DatosDocumentoCotizacion) {
  const niveles = Math.max(1, Math.floor(Number(datos.niveles) || 1));
  const recamaras = Math.max(0, Math.floor(Number(datos.recamaras) || 0));
  const banosNumero = Math.max(0, Number(String(datos.banos).replace(",", ".")) || 0);
  const completos = Math.floor(banosNumero);
  const medio = banosNumero - completos >= 0.5;

  const partes = [
    plural(niveles, "nivel", "niveles"),
    plural(recamaras, "recámara", "recámaras"),
    plural(completos, "baño completo", "baños completos"),
  ];

  if (medio) partes.push("1 medio baño");
  return partes.join(" · ");
}

function datosZonaPie(zonaServicio: ZonaServicio) {
  const zona = obtenerZonaServicio(zonaServicio);
  return [zona.emailContacto, zona.telefono, zona.domicilio]
    .filter(Boolean)
    .join("  |  ");
}

function reemplazosDocx(datos: DatosDocumentoCotizacion) {
  const zona = obtenerZonaServicio(datos.zona);
  const areas = datos.espacios.length
    ? datos.espacios.join(" · ")
    : "No se declararon áreas adicionales.";
  const otros = datos.otrosEspacios.trim()
    ? datos.otrosEspacios.trim()
    : "No se declararon otros espacios o características.";
  const comentarios = datos.comentarios.trim()
    ? datos.comentarios.trim()
    : "Sin comentarios adicionales.";
  const total = moneda(datos.totalPropuesto);
  const mitad = moneda(datos.pago50);

  return new Map<string, string>([
    ["CH-COT-2026-4D0966B2", datos.folio],
    ["09/09/2026", datos.fecha],
    ["Nubia Gandara", datos.nombre],
    ["6566750389", datos.telefono],
    ["anabelsapiensa@gmail.com", datos.correo],
    ["PARTICULAR", datos.tipoCliente],
    ["Paseo Detroit 1030 topcio", datos.direccionInmueble],
    ["juarez", datos.ciudadInmueble],
    ["Terreno: 120 m² · Construcción: 132 m²", `Terreno: ${datos.m2Terreno} m² · Construcción: ${datos.m2Construccion} m²`],
    ["2 niveles · 3 recámaras · 1 baño completo + 1 medio baño", distribucion(datos)],
    ["Cocina · Sala · Comedor · Área de lavado · Lavadero · Cochera · Patio · Cuarto de servicio", areas],
    ["No se declararon otros espacios o características.", otros],
    ["Sin comentarios adicionales.", comentarios],
    ["$5,500.00", total],
    ["$2,750.00", mitad],
    ["656 287 12 18", zona.telefono ?? ""],
    ["Monte Apeninos 6436, Col. La Cuesta, Ciudad Juárez, Chihuahua", zona.domicilio ?? zona.ciudadEstado],
  ]);
}

export async function generarCotizacionDocxAutorizada(
  datos: DatosDocumentoCotizacion,
): Promise<Buffer> {
  const plantilla = await readFile(RUTA_DOCX);
  const zip = await JSZip.loadAsync(plantilla);
  const reemplazos = reemplazosDocx(datos);

  const archivosXml = [
    "word/document.xml",
    "word/header1.xml",
    "word/footer1.xml",
  ];

  for (const nombre of archivosXml) {
    const archivo = zip.file(nombre);
    if (!archivo) continue;

    let xml = await archivo.async("string");
    for (const [buscar, reemplazar] of reemplazos) {
      xml = xml.split(buscar).join(xmlEscape(reemplazar));
    }
    zip.file(nombre, xml);
  }

  return Buffer.from(
    await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
    }),
  );
}

function yDesdeTop(page: PDFPage, top: number, alto: number) {
  return page.getHeight() - top - alto;
}

function cubrir(
  page: PDFPage,
  x: number,
  top: number,
  width: number,
  height: number,
  fondo = rgb(1, 1, 1),
) {
  page.drawRectangle({
    x,
    y: yDesdeTop(page, top, height),
    width,
    height,
    color: fondo,
  });
}

function recortarTexto(texto: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(texto, size) <= maxWidth) return texto;
  let actual = texto;
  while (actual.length > 1 && font.widthOfTextAtSize(`${actual}...`, size) > maxWidth) {
    actual = actual.slice(0, -1);
  }
  return `${actual}...`;
}

function dibujarTexto(
  page: PDFPage,
  texto: string,
  x: number,
  top: number,
  size: number,
  font: PDFFont,
  maxWidth?: number,
  color = rgb(0.12, 0.16, 0.20),
) {
  const valor = maxWidth ? recortarTexto(texto, font, size, maxWidth) : texto;
  page.drawText(valor, {
    x,
    y: page.getHeight() - top - size,
    size,
    font,
    color,
  });
}

function envolver(texto: string, font: PDFFont, size: number, maxWidth: number) {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let linea = "";
  for (const palabra of palabras) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(prueba, size) <= maxWidth) {
      linea = prueba;
    } else {
      if (linea) lineas.push(linea);
      linea = palabra;
    }
  }
  if (linea) lineas.push(linea);
  return lineas;
}

function dibujarParrafo(
  page: PDFPage,
  texto: string,
  x: number,
  top: number,
  width: number,
  size: number,
  font: PDFFont,
  lineHeight = size * 1.35,
  maxLines = 4,
) {
  const lineas = envolver(texto, font, size, width).slice(0, maxLines);
  lineas.forEach((linea, indice) => {
    dibujarTexto(page, linea, x, top + indice * lineHeight, size, font);
  });
}

function pintarCabeceraYFooter(
  page: PDFPage,
  datos: DatosDocumentoCotizacion,
  font: PDFFont,
) {
  const navy = rgb(0.025, 0.09, 0.14);
  cubrir(page, 473, 64, 93, 13, navy);
  dibujarTexto(page, datos.folio, 479, 66, 7.1, font, 84, rgb(1, 1, 1));

  cubrir(page, 520, 76, 46, 13, navy);
  dibujarTexto(page, datos.fecha, 526, 78, 7.1, font, 38, rgb(1, 1, 1));

  cubrir(page, 78, 733, 458, 14, navy);
  dibujarTexto(page, datosZonaPie(datos.zona), 80, 735.1, 6.0, font, 450, rgb(1, 1, 1));
}

function aplicarVariablesPagina1(
  page: PDFPage,
  datos: DatosDocumentoCotizacion,
  regular: PDFFont,
) {
  // Folio y fecha de la tabla superior.
  cubrir(page, 122, 174, 123, 20);
  dibujarTexto(page, datos.folio, 128, 179, 8.6, regular, 112);
  cubrir(page, 386, 174, 70, 20);
  dibujarTexto(page, datos.fecha, 392, 179, 8.6, regular, 58);

  // Datos del cliente e inmueble.
  cubrir(page, 137, 257, 144, 19);
  dibujarTexto(page, datos.nombre, 142, 262, 8.6, regular, 133);
  cubrir(page, 378, 257, 181, 19);
  dibujarTexto(page, datos.telefono, 383, 262, 8.6, regular, 170);

  cubrir(page, 137, 279, 144, 19);
  dibujarTexto(page, datos.correo, 142, 284, 8.4, regular, 133);
  cubrir(page, 378, 279, 181, 19);
  dibujarTexto(page, datos.tipoCliente, 383, 284, 8.6, regular, 170);

  cubrir(page, 137, 301, 144, 19);
  dibujarTexto(page, datos.direccionInmueble, 142, 306, 8.2, regular, 133);
  cubrir(page, 378, 301, 181, 19);
  dibujarTexto(page, datos.ciudadInmueble, 383, 306, 8.2, regular, 170);

  cubrir(page, 137, 323, 144, 34);
  dibujarParrafo(
    page,
    `Terreno: ${datos.m2Terreno} m² · Construcción: ${datos.m2Construccion} m²`,
    142,
    327,
    133,
    8.2,
    regular,
    12.2,
    2,
  );
  cubrir(page, 378, 323, 181, 34);
  dibujarParrafo(page, distribucion(datos), 383, 327, 170, 8.2, regular, 12.2, 2);

  const areas = datos.espacios.length
    ? datos.espacios.join(" · ")
    : "No se declararon áreas adicionales.";
  cubrir(page, 165, 437, 394, 23);
  dibujarParrafo(page, areas, 171, 442, 382, 8.2, regular, 11.4, 2);

  const otros = datos.otrosEspacios.trim()
    ? datos.otrosEspacios.trim()
    : "No se declararon otros espacios o características.";
  cubrir(page, 165, 460, 394, 31);
  dibujarParrafo(page, otros, 171, 466, 382, 8.1, regular, 11.0, 2);

  const comentarios = datos.comentarios.trim()
    ? datos.comentarios.trim()
    : "Sin comentarios adicionales.";
  cubrir(page, 165, 493, 394, 21);
  dibujarTexto(page, comentarios, 171, 499, 8.1, regular, 382);

  cubrir(page, 165, 515, 394, 21);
  dibujarTexto(
    page,
    `Solicitud enviada desde certezahabitacional.com/cotizar · ${datos.fecha}`,
    171,
    521,
    8.0,
    regular,
    382,
  );
}

function aplicarVariablesPagina6(
  page: PDFPage,
  datos: DatosDocumentoCotizacion,
  regular: PDFFont,
  bold: PDFFont,
) {
  const total = moneda(datos.totalPropuesto);
  const mitad = moneda(datos.pago50);

  cubrir(page, 412, 168, 92, 22);
  dibujarTexto(page, `${total} MXN`, 418, 173, 8.6, bold, 82);

  cubrir(page, 40, 202, 524, 31);
  dibujarParrafo(
    page,
    `El total de la presente cotización es de ${total} MXN. Nota: En caso de requerir factura, al importe anterior se adicionará el IVA correspondiente.`,
    43,
    207,
    516,
    9.7,
    regular,
    14.2,
    2,
  );

  cubrir(page, 145, 327, 417, 55);
  dibujarTexto(page, "Al contratar, el cliente podrá seleccionar una de las dos modalidades disponibles:", 149, 332, 8.2, regular, 405);
  dibujarTexto(page, `[ ]  PAGO ÚNICO  ${total} MXN al contratar la inspección.`, 149, 346, 8.2, regular, 405);
  dibujarParrafo(
    page,
    `[ ]  DOS PAGOS 50/50  ${mitad} MXN al contratar la inspección y ${mitad} MXN antes de iniciar la inspección en el inmueble.`,
    149,
    360,
    405,
    8.2,
    regular,
    12.0,
    2,
  );

  cubrir(page, 145, 463, 417, 29);
  dibujarParrafo(
    page,
    `En caso de requerir factura, al importe de ${total} MXN se adicionará el IVA correspondiente.`,
    149,
    467,
    405,
    8.4,
    regular,
    12.0,
    2,
  );
}

function marcaPreCotizacion(page: PDFPage, bold: PDFFont) {
  const texto = "PRE COTIZACIÓN";
  const size = 46;
  page.drawText(texto, {
    x: 110,
    y: 255,
    size,
    font: bold,
    color: rgb(0.63, 0.65, 0.68),
    opacity: 0.085,
    rotate: degrees(42),
  });
}

export async function generarPreCotizacionPdfAutorizada(
  datos: DatosDocumentoCotizacion,
): Promise<Buffer> {
  const plantilla = await readFile(RUTA_PDF);

  // Abrimos la plantilla autorizada únicamente como fuente visual.
  // Después copiamos todas sus páginas a un PDF nuevo para reconstruir
  // por completo catálogo, árbol de páginas y tabla XRef. Esto evita
  // referencias heredadas defectuosas que algunos navegadores reparan
  // automáticamente pero Adobe Acrobat rechaza.
  const fuente = await PDFDocument.load(plantilla, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  const pdf = await PDFDocument.create();
  const indices = fuente.getPageIndices();
  const paginasCopiadas = await pdf.copyPages(fuente, indices);

  for (const pagina of paginasCopiadas) {
    pdf.addPage(pagina);
  }

  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  const paginas = pdf.getPages();
  paginas.forEach((page) => pintarCabeceraYFooter(page, datos, regular));

  if (paginas[0]) aplicarVariablesPagina1(paginas[0], datos, regular);
  if (paginas[5]) aplicarVariablesPagina6(paginas[5], datos, regular, bold);

  paginas.forEach((page) => marcaPreCotizacion(page, bold));

  // Guardamos sin Object Streams para maximizar compatibilidad con Adobe Acrobat.
  // Algunos lectores de navegador toleran estructuras XRef comprimidas que Acrobat rechaza.
  return Buffer.from(
    await pdf.save({
      useObjectStreams: false,
      addDefaultPage: false,
      objectsPerTick: 20,
    }),
  );
}
