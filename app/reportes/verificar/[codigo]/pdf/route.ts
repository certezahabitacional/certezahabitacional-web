import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";

import { nivelEvaluacionV1, obtenerMetricasV1 } from "@/lib/calificacion-v1";
import { prisma } from "@/lib/prisma";

type Punto = {
  area: string | null;
  concepto: string;
  especificacion: string | null;
  estadoV3: string | null;
  observacion: string | null;
  valorMedido: string | null;
  valorProyecto: string | null;
  unidadMedida: string | null;
  orden: number | null;
};

const PAGE_W = 612;
const PAGE_H = 792;
const M = 42;
const CONTENT_W = PAGE_W - M * 2;

function textoSeguro(valor: unknown) {
  return String(valor ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = textoSeguro(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const test = `${line} ${word}`;
    if (font.widthOfTextAtSize(test, size) <= width) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { codigo } = await params;
  const certificado = await prisma.certificado.findUnique({
    where: { codigoValidacion: codigo },
    include: {
      inspeccion: {
        include: {
          cliente: true,
          inmueble: true,
          inspector: { include: { usuario: true } },
          zona: true,
          firmas: { orderBy: { firmadaEn: "desc" } },
          hallazgos: { orderBy: [{ prioridad: "asc" }, { creadoEn: "asc" }] },
          revisiones: {
            where: { rol: "DIRECTOR", decision: "APROBADO", estado: "VIGENTE" },
            orderBy: { creadaEn: "desc" },
            take: 1,
            include: { usuario: true },
          },
        },
      },
    },
  });

  if (!certificado || !certificado.vigente || certificado.inspeccion.estado !== "FINALIZADA") {
    return NextResponse.json({ error: "Reporte oficial no disponible." }, { status: 404 });
  }

  const inspeccion = certificado.inspeccion;
  const metricas = inspeccion.numeroInspeccion === 1 ? await obtenerMetricasV1(inspeccion.id) : null;
  const puntos = inspeccion.numeroInspeccion === 1
    ? await prisma.$queryRaw<Punto[]>`
        SELECT
          a."nombre" AS "area",
          g."concepto",
          g."especificacion",
          g."estadoV3",
          g."observacion",
          g."valorMedido",
          g."valorProyecto",
          g."unidadMedida",
          g."orden"
        FROM "GuiaInspeccionItem" g
        LEFT JOIN "AreaInspeccion" a ON a."id"=g."areaId"
        WHERE g."inspeccionId"=${inspeccion.id}
          AND g."estadoV3" IN ('REVISADO','CON_HALLAZGO')
        ORDER BY COALESCE(a."orden",999999), COALESCE(g."orden",999999), g."concepto"
      `
    : [];

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let logo: PDFImage | null = null;
  try {
    const logoBytes = await readFile(join(process.cwd(), "public", "branding", "logo-gold.png"));
    logo = await pdf.embedPng(logoBytes);
  } catch {}

  let page!: PDFPage;
  let y = 0;

  const newPage = (title?: string) => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - M;
    if (title) {
      page.drawText(title, { x: M, y: y - 16, size: 16, font: bold, color: rgb(0.08,0.12,0.2) });
      y -= 34;
      page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1, color: rgb(0.82,0.65,0.25) });
      y -= 16;
    }
  };

  const ensure = (height: number, title?: string) => {
    if (y - height < M + 28) newPage(title);
  };

  const line = (text: string, opts?: { bold?: boolean; size?: number; indent?: number; gap?: number }) => {
    const font = opts?.bold ? bold : regular;
    const size = opts?.size ?? 10;
    const indent = opts?.indent ?? 0;
    const gap = opts?.gap ?? 4;
    const lines = wrap(text, font, size, CONTENT_W - indent);
    const h = lines.length * (size + 3) + gap;
    ensure(h);
    for (const value of lines) {
      page.drawText(value, { x: M + indent, y, size, font, color: rgb(0.12,0.16,0.22) });
      y -= size + 3;
    }
    y -= gap;
  };

  const heading = (text: string) => {
    ensure(28);
    y -= 4;
    line(text, { bold: true, size: 13, gap: 8 });
  };

  const fecha = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit", month: "long", year: "numeric", timeZone: inspeccion.zonaHoraria,
  }).format(inspeccion.fechaProgramada);

  newPage();
  page.drawRectangle({ x: 22, y: 22, width: PAGE_W - 44, height: PAGE_H - 44, borderWidth: 3, borderColor: rgb(0.12,0.16,0.22) });
  page.drawRectangle({ x: 29, y: 29, width: PAGE_W - 58, height: PAGE_H - 58, borderWidth: 1, borderColor: rgb(0.82,0.65,0.25) });
  y = PAGE_H - 90;
  if (logo) {
    const escala = 74 / logo.width;
    page.drawImage(logo, { x: M, y: y - 4, width: 74, height: logo.height * escala });
    page.drawText("CERTEZA HABITACIONAL", { x: M + 88, y: y + 14, size: 23, font: bold, color: rgb(0.08,0.12,0.2) });
  } else {
    page.drawText("CERTEZA HABITACIONAL", { x: M, y, size: 25, font: bold, color: rgb(0.08,0.12,0.2) });
  }
  y -= 38;
  page.drawText("REPORTE OFICIAL DE INSPECCION", { x: M, y, size: 18, font: bold, color: rgb(0.82,0.52,0.08) });
  y -= 34;
  line(`Folio de inspección: ${inspeccion.folio}`, { bold: true, size: 12 });
  line(`Certificado: ${certificado.folio}`, { bold: true });
  line(`Cliente: ${inspeccion.cliente.nombre}`);
  line(`Inmueble: ${inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble}`);
  line(`Dirección: ${inspeccion.direccion}, ${inspeccion.ciudad}`);
  line(`Fecha de inspección: ${fecha}`);
  line(`Inspector: ${inspeccion.inspector?.usuario.nombre ?? "Inspector asignado"}`);
  if (inspeccion.revisiones[0]) {
    line(`Autorizado por Dirección: ${inspeccion.revisiones[0].usuario.nombre} · ${inspeccion.revisiones[0].creadaEn.toLocaleString("es-MX")}`);
  }
  y -= 14;
  line("Documento oficial autorizado por Dirección. La versión consultada mediante este código corresponde al expediente final vigente.", { size: 10 });

  newPage("Resumen ejecutivo");
  if (metricas) {
    line(`Calificación Técnica Certeza: ${metricas.calificacion.toFixed(2)}/100 · ${nivelEvaluacionV1(metricas.calificacion)}`, { bold: true, size: 13 });
    line(`Cobertura efectiva: ${metricas.cobertura.toFixed(2)}%`);
    line(`Áreas revisadas: ${metricas.areas} · Puntos revisados: ${metricas.revisados} · Áreas sin hallazgos: ${metricas.areasSinHallazgos}`);
    line(`Prioridades: P1 ${metricas.resumenPrioridades.P1} · P2 ${metricas.resumenPrioridades.P2} · P3 ${metricas.resumenPrioridades.P3} · P4 ${metricas.resumenPrioridades.P4} · P5 ${metricas.resumenPrioridades.P5}`);
    heading("Dictamen");
    line(metricas.dictamen, { size: 11 });
  } else {
    line(`Índice registrado: ${Number(certificado.ish).toFixed(2)}/100`, { bold: true, size: 13 });
    heading("Dictamen");
    line(certificado.dictamen, { size: 11 });
  }

  if (puntos.length) {
    newPage("Desarrollo de la inspección");
    let areaActual = "";
    let consecutivo = 1;
    for (const punto of puntos) {
      const area = punto.area || "Partida técnica";
      if (area !== areaActual) {
        areaActual = area;
        heading(areaActual);
      }
      const estado = punto.estadoV3 === "CON_HALLAZGO" ? "CON HALLAZGO" : "SIN HALLAZGO";
      line(`${consecutivo}. ${punto.concepto} · ${estado}`, { bold: true, size: 10 });
      if (punto.especificacion) line(punto.especificacion, { size: 9, indent: 12 });
      if (punto.valorMedido || punto.valorProyecto) {
        line(`Medición: ${punto.valorMedido ?? "—"} ${punto.unidadMedida ?? ""}${punto.valorProyecto ? ` · Referencia: ${punto.valorProyecto} ${punto.unidadMedida ?? ""}` : ""}`, { size: 9, indent: 12 });
      }
      if (punto.observacion) {
        let obs = punto.observacion;
        try {
          const parsed = JSON.parse(punto.observacion) as Record<string, unknown>;
          obs = textoSeguro(parsed.descripcionFinal ?? parsed.justificacionCalificacionIa ?? punto.observacion);
        } catch {}
        line(`Observación: ${obs}`, { size: 9, indent: 12 });
      }
      y -= 4;
      consecutivo += 1;
    }
  }

  if (inspeccion.hallazgos.length) {
    newPage("Hallazgos y recomendaciones");
    for (const h of inspeccion.hallazgos) {
      heading(`${h.prioridad} · ${h.titulo}`);
      line(`Área: ${h.area} · Clasificación: ${h.clasificacion}`, { bold: true, size: 9 });
      line(h.descripcion, { size: 10 });
      if (h.recomendacion) line(`Recomendación: ${h.recomendacion}`, { size: 10 });
    }
  }

  newPage("Firmas y cierre documental");
  const firmaInspector = inspeccion.firmas.find((f) => f.tipo.toUpperCase().includes("INSPECTOR"));
  const firmaCliente = inspeccion.firmas.find((f) => f.tipo.toUpperCase().includes("CLIENTE"));
  line(`Inspector: ${firmaInspector?.nombreFirmante ?? inspeccion.inspector?.usuario.nombre ?? "Inspector asignado"}`, { bold: true });
  line(`Firma registrada: ${firmaInspector?.firmadaEn ? firmaInspector.firmadaEn.toLocaleString("es-MX") : "No disponible"}`);
  y -= 8;
  line(`Cliente: ${firmaCliente?.nombreFirmante ?? inspeccion.cliente.nombre}`, { bold: true });
  line(`Firma registrada: ${firmaCliente?.firmadaEn ? firmaCliente.firmadaEn.toLocaleString("es-MX") : "No disponible"}`);
  y -= 18;
  line(`Código de validación: ${certificado.codigoValidacion}`, { bold: true });
  line("www.certezahabitacional.com", { bold: true });
  line("Este reporte oficial debe interpretarse conforme al alcance contratado, las partidas accesibles y las condiciones existentes al momento de la inspección.", { size: 9 });

  // Última hoja: certificado, sin encabezado ni pie del reporte.
  page = pdf.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 24, y: 24, width: PAGE_W - 48, height: PAGE_H - 48, borderWidth: 4, borderColor: rgb(0.03,0.06,0.14) });
  page.drawRectangle({ x: 34, y: 34, width: PAGE_W - 68, height: PAGE_H - 68, borderWidth: 1.5, borderColor: rgb(0.86,0.58,0.08) });

  if (logo) {
    const escala = 92 / logo.width;
    page.drawImage(logo, { x: 54, y: 654, width: 92, height: logo.height * escala });
  }
  page.drawText("CERTIFICADO CERTEZA HABITACIONAL", { x: 164, y: 706, size: 19, font: bold, color: rgb(0.03,0.06,0.14) });
  page.drawText("Resultado final autorizado", { x: 164, y: 684, size: 10, font: regular, color: rgb(0.35,0.40,0.47) });

  let cy = 620;
  const certLine = (label: string, value: string) => {
    page.drawText(label, { x: 58, y: cy, size: 8, font: bold, color: rgb(0.45,0.49,0.56) });
    page.drawText(value, { x: 220, y: cy, size: 11, font: bold, color: rgb(0.05,0.08,0.14), maxWidth: 300 });
    cy -= 34;
  };
  certLine("CERTIFICADO", certificado.folio);
  certLine("INSPECCIÓN", inspeccion.folio);
  certLine("CLIENTE", inspeccion.cliente.nombre);
  certLine("INMUEBLE", inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble);
  certLine("CALIFICACIÓN TÉCNICA CERTEZA", `${Number(certificado.ish).toFixed(2)} / 100`);
  if (metricas) certLine("COBERTURA", `${metricas.cobertura.toFixed(2)}%`);
  if (inspeccion.revisiones[0]) certLine("AUTORIZADO POR DIRECCIÓN", inspeccion.revisiones[0].usuario.nombre);

  const qrPng = await QRCode.toBuffer(
    `${request.nextUrl.origin}/certificados/verificar/${certificado.codigoValidacion}`,
    { width: 220, margin: 1, errorCorrectionLevel: "M", type: "png" },
  );
  const qrImage = await pdf.embedPng(qrPng);
  page.drawImage(qrImage, { x: 390, y: 438, width: 130, height: 130 });
  page.drawText("Validar certificado", { x: 402, y: 422, size: 8, font: bold, color: rgb(0.05,0.08,0.14) });

  page.drawText("DICTAMEN", { x: 58, y: 360, size: 9, font: bold, color: rgb(0.45,0.49,0.56) });
  const certRows = wrap(certificado.dictamen, regular, 9, 496).slice(0, 12);
  let certTextY = 342;
  for (const row of certRows) {
    page.drawText(row, { x: 58, y: certTextY, size: 9, font: regular, color: rgb(0.18,0.22,0.28) });
    certTextY -= 13;
  }
  page.drawText(`Código de validación: ${certificado.codigoValidacion}`, { x: 58, y: 72, size: 8, font: bold, color: rgb(0.05,0.08,0.14) });

  const paginas = pdf.getPages();
  paginas.forEach((pagina, indice) => {
    const esPortada = indice === 0;
    const esCertificado = indice === paginas.length - 1;
    if (esPortada || esCertificado) return;

    pagina.drawRectangle({
      x: 0,
      y: PAGE_H - 34,
      width: PAGE_W,
      height: 34,
      color: rgb(0.02,0.04,0.10),
    });
    if (logo) {
      const escala = 28 / logo.width;
      pagina.drawImage(logo, { x: 34, y: PAGE_H - 31, width: 28, height: logo.height * escala });
    }
    pagina.drawText("CERTEZA HABITACIONAL", { x: 70, y: PAGE_H - 21, size: 8, font: bold, color: rgb(0.95,0.75,0.18) });
    pagina.drawText(inspeccion.folio, { x: PAGE_W - 130, y: PAGE_H - 21, size: 8, font: bold, color: rgb(1,1,1) });

    pagina.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_W,
      height: 24,
      color: rgb(0.02,0.04,0.10),
    });
    const etiqueta = `Pág. ${indice + 1} / ${paginas.length}`;
    pagina.drawText("CH-R-001", { x: 34, y: 8, size: 7, font: bold, color: rgb(0.95,0.95,0.95) });
    pagina.drawText(etiqueta, { x: PAGE_W - 92, y: 8, size: 7, font: bold, color: rgb(0.95,0.95,0.95) });
  });

  const bytes = await pdf.save();
  const descargar = request.nextUrl.searchParams.get("download") === "1";
  const nombre = `${inspeccion.folio}-reporte-oficial.pdf`.replace(/[^A-Za-z0-9._-]/g, "_");

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${nombre}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
