import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFPage,
  type PDFFont,
  type PDFImage,
} from "pdf-lib";

import { obtenerZonaServicio, type ZonaServicio } from "@/lib/configuracion-zonas";

export type ConceptoPreCotizacion = {
  concepto: string;
  importe: number;
};

export type DatosPreCotizacionPdf = {
  folio: string;
  nombre: string;
  telefono: string;
  correo: string;
  tipoCliente: string;
  empresa: string;
  ciudadCliente: string;
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
  conceptos: ConceptoPreCotizacion[];
  importeTecnico: number;
  totalPropuesto: number;
  pago50: number;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 44;
const NAVY = rgb(0.027, 0.102, 0.165);
const GOLD = rgb(0.85, 0.64, 0.18);
const TEXT = rgb(0.08, 0.12, 0.18);
const MUTED = rgb(0.31, 0.36, 0.43);
const LINE = rgb(0.79, 0.82, 0.85);
const LIGHT = rgb(0.965, 0.97, 0.975);
const WHITE = rgb(1, 1, 1);

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function generarPreCotizacionPdf(data: DatosPreCotizacionPdf) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const zona = obtenerZonaServicio(data.zona);
  let logo: PDFImage | null = null;
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", "branding", "logo-autorizado.png"));
    logo = await pdf.embedPng(bytes);
  } catch {
    logo = null;
  }

  function drawWatermark(page: PDFPage) {
    page.drawText("PRE COTIZACIÓN", {
      x: 105,
      y: 330,
      size: 58,
      font: bold,
      color: rgb(0.45, 0.48, 0.52),
      rotate: degrees(45),
      opacity: 0.055,
    });
  }

  function header(page: PDFPage, title = "COTIZACIÓN DE SERVICIOS") {
    page.drawRectangle({ x: 0, y: PAGE_H - 108, width: PAGE_W, height: 108, color: NAVY });
    if (logo) {
      const scale = Math.min(68 / logo.width, 68 / logo.height);
      page.drawImage(logo, {
        x: M,
        y: PAGE_H - 91,
        width: logo.width * scale,
        height: logo.height * scale,
      });
    }
    page.drawText("CERTEZA HABITACIONAL", { x: logo ? 125 : M, y: PAGE_H - 48, size: 17, font: bold, color: WHITE });
    page.drawText("Inspección técnica de viviendas", { x: logo ? 125 : M, y: PAGE_H - 68, size: 8.5, font: bold, color: GOLD });
    page.drawText("Revisamos cada rincón antes de que des el sí", { x: logo ? 125 : M, y: PAGE_H - 84, size: 7.5, font: regular, color: WHITE });
    const rightX = 375;
    page.drawText(title, { x: rightX, y: PAGE_H - 35, size: 10.5, font: bold, color: GOLD });
    page.drawText(`Folio: ${data.folio}`, { x: rightX, y: PAGE_H - 53, size: 7.5, font: regular, color: WHITE });
    page.drawText(`Zona: ${zona.nombre}`, { x: rightX, y: PAGE_H - 69, size: 7.5, font: regular, color: WHITE });
    page.drawText("Vigencia: 15 días", { x: rightX, y: PAGE_H - 85, size: 7.5, font: regular, color: WHITE });
    drawWatermark(page);
  }

  function footer(page: PDFPage) {
    const y = 27;
    page.drawLine({ start: { x: M, y: y + 18 }, end: { x: PAGE_W - M, y: y + 18 }, color: GOLD, thickness: 0.7 });
    const contacto = [zona.emailContacto, zona.telefono, zona.domicilio].filter(Boolean).join("  |  ");
    const lines = wrap(regular, contacto || "Certeza Habitacional", 6.5, PAGE_W - M * 2);
    lines.slice(0, 2).forEach((line, i) => page.drawText(line, { x: M, y: y - i * 9, size: 6.5, font: regular, color: MUTED }));
  }

  function addPage(title?: string) {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    header(page, title);
    footer(page);
    return page;
  }

  function section(page: PDFPage, text: string, y: number) {
    page.drawText(text, { x: M, y, size: 13.5, font: bold, color: NAVY });
    return y - 24;
  }

  function labelValue(page: PDFPage, label: string, value: string, x: number, y: number, width = 230) {
    page.drawText(label, { x, y, size: 8.5, font: bold, color: NAVY });
    const lines = wrap(regular, value || "—", 8.5, width - 78);
    lines.slice(0, 2).forEach((line, i) => page.drawText(line, { x: x + 78, y: y - i * 11, size: 8.5, font: regular, color: TEXT }));
  }

  function bullet(page: PDFPage, text: string, y: number) {
    page.drawCircle({ x: M + 3, y: y + 3, size: 2.2, color: GOLD });
    const lines = wrap(regular, text, 9, PAGE_W - M * 2 - 20);
    lines.forEach((line, i) => page.drawText(line, { x: M + 16, y: y - i * 12, size: 9, font: regular, color: TEXT }));
    return y - lines.length * 12 - 7;
  }

  // PAGE 1 — same identity and data block as internal quotation
  let page = addPage();
  let y = PAGE_H - 145;
  page.drawText("Propuesta de inspección técnica de vivienda", { x: M, y, size: 15, font: bold, color: GOLD });
  y -= 22;
  page.drawText("Revisamos cada rincón antes de que des el sí.", { x: M, y, size: 9, font: regular, color: MUTED });
  y -= 34;
  y = section(page, "1. DATOS DEL CLIENTE E INMUEBLE", y);
  page.drawRectangle({ x: M, y: y - 145, width: PAGE_W - M * 2, height: 150, borderColor: LINE, borderWidth: 0.8, color: WHITE });
  const rowYs = [y - 18, y - 48, y - 78, y - 108, y - 138];
  rowYs.forEach((ry) => page.drawLine({ start: { x: M, y: ry + 12 }, end: { x: PAGE_W - M, y: ry + 12 }, color: LINE, thickness: 0.5 }));
  labelValue(page, "Cliente", data.nombre, M + 8, y - 10, 245);
  labelValue(page, "Teléfono", data.telefono, 315, y - 10, 235);
  labelValue(page, "Correo", data.correo, M + 8, y - 40, 245);
  labelValue(page, "Tipo de cliente", data.tipoCliente, 315, y - 40, 235);
  labelValue(page, "Empresa", data.empresa || "No aplica", M + 8, y - 70, 245);
  labelValue(page, "Ciudad cliente", data.ciudadCliente, 315, y - 70, 235);
  labelValue(page, "Inmueble", data.direccionInmueble, M + 8, y - 100, 245);
  labelValue(page, "Ciudad", data.ciudadInmueble, 315, y - 100, 235);
  labelValue(page, "Superficies", `Terreno: ${data.m2Terreno} m² · Construcción: ${data.m2Construccion} m²`, M + 8, y - 130, 245);
  labelValue(page, "Distribución", `${data.niveles || "1"} niveles · ${data.recamaras} recámaras · ${data.banos} baños`, 315, y - 130, 235);
  y -= 182;
  y = section(page, "2. ÁREAS Y CARACTERÍSTICAS DECLARADAS POR EL CLIENTE", y);
  const espacios = data.espacios.length ? data.espacios.join(" · ") : "No se seleccionaron espacios.";
  y = bullet(page, `Espacios declarados: ${espacios}`, y);
  y = bullet(page, `Otros espacios o características: ${data.otrosEspacios || "Ninguno"}`, y);
  y = bullet(page, `Comentarios del cliente: ${data.comentarios || "Sin comentarios adicionales"}`, y);

  // PAGE 2 — calculation breakdown exactly present in internal mail
  page = addPage();
  y = PAGE_H - 150;
  y = section(page, "3. COTIZACIÓN AUTOMÁTICA PRELIMINAR", y);
  page.drawText(`Folio: ${data.folio}`, { x: M, y, size: 9, font: bold, color: TEXT });
  y -= 26;
  page.drawText("Desglose interno de cálculo", { x: M, y, size: 10, font: bold, color: NAVY });
  y -= 18;
  page.drawRectangle({ x: M, y: y - 24, width: PAGE_W - M * 2, height: 26, color: GOLD });
  page.drawText("Concepto", { x: M + 10, y: y - 8, size: 8.5, font: bold, color: TEXT });
  page.drawText("Importe", { x: PAGE_W - M - 80, y: y - 8, size: 8.5, font: bold, color: TEXT });
  y -= 34;
  for (const item of data.conceptos) {
    const lines = wrap(regular, item.concepto, 8.2, 380);
    lines.forEach((line, i) => page.drawText(line, { x: M + 10, y: y - i * 10, size: 8.2, font: regular, color: TEXT }));
    page.drawText(money(item.importe), { x: PAGE_W - M - 90, y, size: 8.2, font: regular, color: TEXT });
    const h = Math.max(22, lines.length * 10 + 8);
    page.drawLine({ start: { x: M, y: y - h + 6 }, end: { x: PAGE_W - M, y: y - h + 6 }, color: LINE, thickness: 0.45 });
    y -= h;
  }
  y -= 12;
  page.drawRectangle({ x: M, y: y - 74, width: PAGE_W - M * 2, height: 78, color: rgb(1, 0.98, 0.90), borderColor: GOLD, borderWidth: 0.8 });
  page.drawText(`Importe técnico calculado: ${money(data.importeTecnico)}`, { x: M + 16, y: y - 24, size: 9.5, font: regular, color: MUTED });
  page.drawText(`TOTAL PROPUESTO: ${money(data.totalPropuesto)}`, { x: M + 16, y: y - 51, size: 17, font: bold, color: NAVY });
  y -= 105;
  y = bullet(page, "En caso de requerir factura, al importe anterior se adicionará el IVA correspondiente.", y);
  y = bullet(page, "El importe es preliminar y puede ajustarse después de validar la información y el alcance real del inmueble.", y);

  // PAGE 3 — payment modalities
  page = addPage();
  y = PAGE_H - 150;
  y = section(page, "4. MODALIDADES DE PAGO", y);
  y = bullet(page, `Pago único de ${money(data.totalPropuesto)} al contratar la inspección.`, y);
  y = bullet(page, `Dos pagos del 50%: ${money(data.pago50)} al contratar y ${money(data.pago50)} antes de iniciar la inspección.`, y);
  y -= 12;
  y = section(page, "5. REGLAS PARA PROGRAMAR E INICIAR", y);
  y = bullet(page, "No se programa una inspección que no tenga cubierto, cuando menos, el primer pago.", y);
  y = bullet(page, "No se inicia ninguna inspección si no se ha liquidado el 100% del importe acordado.", y);
  y = bullet(page, "La programación está sujeta a disponibilidad operativa y a la confirmación de los datos proporcionados.", y);

  // PAGE 4 — instrumental scope copied from internal email
  page = addPage();
  y = PAGE_H - 150;
  y = section(page, "6. ALCANCE INSTRUMENTAL PRELIMINAR", y);
  const instrumentos = [
    "Cámara térmica.",
    "Probador de contactos GFCI/RCD.",
    "Detector de voltaje sin contacto.",
    "Multímetro profesional.",
    "Nivel láser autonivelante.",
    "Medidor láser de distancia.",
    "Martillo/rodillo de auscultación.",
    "Linterna LED profesional.",
    "Manómetro para agua.",
    "Detector de gas combustible.",
    "Prueba de hermeticidad hidráulica, cuando las condiciones del inmueble permitan realizarla de forma segura.",
    "Prueba de hermeticidad de gas, cuando las condiciones del inmueble permitan realizarla de forma segura.",
  ];
  for (const item of instrumentos) y = bullet(page, item, y);

  // PAGE 5 — preliminary character and operating conditions
  page = addPage();
  y = PAGE_H - 150;
  y = section(page, "7. CARÁCTER PRELIMINAR Y VALIDACIÓN", y);
  y = bullet(page, "Esta pre cotización se genera automáticamente con base exclusivamente en la información proporcionada por el solicitante.", y);
  y = bullet(page, "Certeza Habitacional aún no ha validado las características, condiciones ni alcance particular del inmueble.", y);
  y = bullet(page, "El importe y alcance indicados están sujetos a confirmación y podrán ratificarse, ajustarse o sustituirse una vez revisada la información.", y);
  y -= 8;
  y = section(page, "8. CONDICIONES IMPORTANTES DEL SERVICIO", y);
  y = bullet(page, "La inspección debe contratarse, como mínimo, 3 días antes de la fecha en que se requiere el servicio.", y);
  y = bullet(page, "Es muy importante proporcionar previamente toda la información disponible: proyectos, planos, especificaciones, memorias, requerimientos especiales y cualquier antecedente relevante.", y);
  y = bullet(page, "Debe notificarse a quien entregará la vivienda que, durante la inspección, es importante que estén presentes únicamente el contratante del servicio y el personal de Certeza Habitacional, para realizar la inspección con mayor libertad e independencia.", y);

  // PAGE 6 — final notes and zone-specific contact
  page = addPage();
  y = PAGE_H - 150;
  y = section(page, "9. SIGUIENTES PASOS", y);
  const pasos = [
    "Revisa cuidadosamente esta pre cotización y los datos declarados.",
    "Envía toda la documentación técnica disponible antes de la inspección.",
    "Certeza Habitacional validará información, alcance y disponibilidad.",
    "Con la validación y cuando menos el primer pago, podrá programarse la inspección.",
    "Antes de iniciar la inspección deberá encontrarse liquidado el 100% del importe acordado.",
  ];
  pasos.forEach((item, index) => {
    page.drawCircle({ x: M + 12, y: y + 3, size: 11, color: GOLD });
    page.drawText(String(index + 1), { x: M + 9, y, size: 8.5, font: bold, color: TEXT });
    const lines = wrap(regular, item, 9.2, PAGE_W - M * 2 - 38);
    lines.forEach((line, i) => page.drawText(line, { x: M + 34, y: y - i * 12, size: 9.2, font: regular, color: TEXT }));
    y -= lines.length * 12 + 18;
  });
  y -= 8;
  page.drawRectangle({ x: M, y: 155, width: PAGE_W - M * 2, height: 120, color: LIGHT, borderColor: LINE, borderWidth: 0.7 });
  page.drawText("Datos de contacto de la zona", { x: M + 16, y: 250, size: 11.5, font: bold, color: NAVY });
  page.drawText(zona.ciudadEstado, { x: M + 16, y: 226, size: 9.5, font: bold, color: GOLD });
  page.drawText(zona.emailContacto, { x: M + 16, y: 207, size: 8.5, font: regular, color: TEXT });
  if (zona.telefono) page.drawText(`Teléfono / WhatsApp: ${zona.telefono}`, { x: M + 16, y: 189, size: 8.5, font: regular, color: TEXT });
  if (zona.domicilio) {
    wrap(regular, zona.domicilio, 8.2, PAGE_W - M * 2 - 32).slice(0, 2).forEach((line, i) =>
      page.drawText(line, { x: M + 16, y: 171 - i * 10, size: 8.2, font: regular, color: MUTED }),
    );
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
