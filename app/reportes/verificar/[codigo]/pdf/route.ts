import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";

import { nivelEvaluacionV1, obtenerMetricasV1 } from "@/lib/calificacion-v1";
import { prisma } from "@/lib/prisma";
import { obtenerSupabaseAdmin } from "@/lib/supabase-admin";
import { contactoDocumentoPorZona } from "@/lib/datos-documentales";

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
const NAVY = rgb(0.025, 0.075, 0.11);
const GOLD = rgb(0.86, 0.64, 0.18);
const SLATE = rgb(0.12, 0.16, 0.22);
const MUTED = rgb(0.40, 0.44, 0.50);
const ADDRESS = "Monte Apeninos 6436, Col. La Cuesta, Ciudad Juárez, Chihuahua";

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

async function cargarImagenBytes(url: string | null) {
  if (!url) return null;
  try {
    if (/^https?:\/\//i.test(url)) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    }
    const sb = obtenerSupabaseAdmin();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";
    const { data, error } = await sb.storage.from(bucket).download(url);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}

async function incrustarImagen(pdf: PDFDocument, url: string | null) {
  const bytes = await cargarImagenBytes(url);
  if (!bytes) return null;
  try {
    return await pdf.embedPng(bytes);
  } catch {}
  try {
    return await pdf.embedJpg(bytes);
  } catch {}
  return null;
}

function dibujarImagenAjustada(page: PDFPage, image: PDFImage, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / image.width, height / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  page.drawRectangle({ x, y, width, height, color: rgb(0.97, 0.98, 0.99), borderColor: rgb(0.82, 0.84, 0.87), borderWidth: 0.8 });
  page.drawImage(image, {
    x: x + (width - w) / 2,
    y: y + (height - h) / 2,
    width: w,
    height: h,
  });
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
          hallazgos: {
            orderBy: [{ prioridad: "asc" }, { creadoEn: "asc" }],
            include: { fotografias: { orderBy: { creadaEn: "asc" } } },
          },
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
  const contacto = contactoDocumentoPorZona(inspeccion.zona?.codigo, inspeccion.zona?.ciudad ?? inspeccion.ciudad);
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

  const [fachada] = await prisma.$queryRaw<Array<{ url: string | null }>>`
    SELECT f."url"
    FROM "AreaInspeccion" a
    JOIN "FotografiaArea" fa ON fa."areaId"=a."id"
    JOIN "Fotografia" f ON f."id"=fa."fotografiaId"
    WHERE a."inspeccionId"=${inspeccion.id}
      AND a."codigo" IN ('FACHADA_FRONTAL','FACHADA_PRINCIPAL')
      AND fa."candidataPortada"=true
    ORDER BY f."creadaEn" ASC
    LIMIT 1
  `;

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let logo: PDFImage | null = null;
  try {
    const logoBytes = await readFile(join(process.cwd(), "public", "branding", "logo-gold.png"));
    logo = await pdf.embedPng(logoBytes);
  } catch {}

  const portada = await incrustarImagen(pdf, fachada?.url ?? null);

  let page!: PDFPage;
  let y = 0;
  const paginasInteriores = new Set<number>();

  const newPage = (title?: string) => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    paginasInteriores.add(pdf.getPageCount() - 1);
    y = PAGE_H - 68;
    if (title) {
      page.drawText(title, { x: M, y, size: 16, font: bold, color: NAVY });
      y -= 15;
      page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1.2, color: GOLD });
      y -= 18;
    }
  };

  const ensure = (height: number, title?: string) => {
    if (y - height < 46) newPage(title);
  };

  const line = (text: string, opts?: { bold?: boolean; size?: number; indent?: number; gap?: number; color?: ReturnType<typeof rgb> }) => {
    const font = opts?.bold ? bold : regular;
    const size = opts?.size ?? 10;
    const indent = opts?.indent ?? 0;
    const gap = opts?.gap ?? 4;
    const lines = wrap(text, font, size, CONTENT_W - indent);
    const h = lines.length * (size + 3) + gap;
    ensure(h);
    for (const value of lines) {
      page.drawText(value, { x: M + indent, y, size, font, color: opts?.color ?? SLATE });
      y -= size + 3;
    }
    y -= gap;
  };

  const heading = (text: string) => {
    ensure(30);
    y -= 3;
    line(text, { bold: true, size: 13, gap: 7, color: NAVY });
  };

  const fecha = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: inspeccion.zonaHoraria,
  }).format(inspeccion.fechaProgramada);

  // PORTADA: deliberadamente sin encabezado ni pie del reporte.
  page = pdf.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 20, y: 20, width: PAGE_W - 40, height: PAGE_H - 40, borderWidth: 3.2, borderColor: NAVY });
  page.drawRectangle({ x: 28, y: 28, width: PAGE_W - 56, height: PAGE_H - 56, borderWidth: 1.2, borderColor: GOLD });

  page.drawRectangle({ x: 28, y: 650, width: PAGE_W - 56, height: 114, color: NAVY });
  if (logo) {
    const escala = 82 / logo.width;
    page.drawImage(logo, { x: 46, y: 670, width: 82, height: logo.height * escala });
  }
  page.drawText("CERTEZA HABITACIONAL", { x: 144, y: 717, size: 22, font: bold, color: rgb(1,1,1) });
  page.drawText("Reporte de inspección autorizado", { x: 144, y: 694, size: 11, font: bold, color: GOLD });
  page.drawText(inspeccion.folio, { x: 144, y: 675, size: 10, font: regular, color: rgb(0.87,0.89,0.92) });

  if (portada) {
    dibujarImagenAjustada(page, portada, 48, 436, 516, 186);
  }

  page.drawText("DATOS DEL EXPEDIENTE", { x: 48, y: 410, size: 9, font: bold, color: GOLD });
  const coverRows: Array<[string,string]> = [
    ["Cliente", inspeccion.cliente.nombre],
    ["Inmueble", inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble],
    ["Dirección", `${inspeccion.direccion}, ${inspeccion.ciudad}`],
    ["Fecha de inspección", fecha],
    ["Inspector", inspeccion.inspector?.usuario.nombre ?? "Inspector asignado"],
    ["Cotización de origen", inspeccion.cotizacionId ? "Expediente vinculado" : "—"],
  ];
  let cy = 388;
  for (const [label, value] of coverRows) {
    page.drawText(label.toUpperCase(), { x: 48, y: cy, size: 7.5, font: bold, color: MUTED });
    const rows = wrap(value, bold, 10.5, 360);
    rows.slice(0,2).forEach((row, idx) => page.drawText(row, { x: 190, y: cy - idx*13, size: 10.5, font: bold, color: NAVY }));
    cy -= Math.max(26, rows.slice(0,2).length * 13 + 8);
  }
  page.drawText("MÉTODO CERTEZA", { x: 48, y: 105, size: 8.5, font: bold, color: GOLD });
  page.drawText("Experiencia técnica + metodología + tecnología + criterio profesional", { x: 48, y: 88, size: 9, font: regular, color: MUTED });
  page.drawText("Documento final autorizado por Dirección", { x: 48, y: 66, size: 8.5, font: bold, color: NAVY });

  newPage("Resumen ejecutivo");
  if (metricas) {
    page.drawRectangle({ x: M, y: y - 56, width: CONTENT_W, height: 56, color: rgb(0.96,0.97,0.98) });
    page.drawText(`${metricas.calificacion.toFixed(2)}/100`, { x: M + 18, y: y - 34, size: 23, font: bold, color: NAVY });
    page.drawText(nivelEvaluacionV1(metricas.calificacion), { x: M + 165, y: y - 34, size: 23, font: bold, color: GOLD });
    page.drawText(`${metricas.cobertura.toFixed(2)}%`, { x: M + 275, y: y - 34, size: 23, font: bold, color: NAVY });
    page.drawText("CALIFICACIÓN", { x: M + 18, y: y - 49, size: 7, font: bold, color: MUTED });
    page.drawText("NIVEL", { x: M + 165, y: y - 49, size: 7, font: bold, color: MUTED });
    page.drawText("COBERTURA", { x: M + 275, y: y - 49, size: 7, font: bold, color: MUTED });
    y -= 78;
    line(`Partidas revisadas: ${metricas.areas} · Puntos revisados: ${metricas.revisados} · Partidas sin hallazgos: ${metricas.areasSinHallazgos}`, { bold: true });
    line(`Prioridades: P1 ${metricas.resumenPrioridades.P1} · P2 ${metricas.resumenPrioridades.P2} · P3 ${metricas.resumenPrioridades.P3} · P4 ${metricas.resumenPrioridades.P4} · P5 ${metricas.resumenPrioridades.P5}`);
    heading("Conclusión técnica");
    page.drawRectangle({ x: M, y: y - 72, width: CONTENT_W, height: 72, color: NAVY });
    const dictamenRows = wrap(metricas.dictamen, regular, 10, CONTENT_W - 28).slice(0,5);
    let dy = y - 22;
    for (const row of dictamenRows) {
      page.drawText(row, { x: M + 14, y: dy, size: 10, font: regular, color: rgb(1,1,1) });
      dy -= 13;
    }
    y -= 88;
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
      if (punto.especificacion) line(punto.especificacion, { size: 9, indent: 12, color: MUTED });
      if (punto.valorMedido || punto.valorProyecto) {
        line(`Medición: ${punto.valorMedido ?? "—"} ${punto.unidadMedida ?? ""}${punto.valorProyecto ? ` · Referencia: ${punto.valorProyecto} ${punto.unidadMedida ?? ""}` : ""}`, { size: 9, indent: 12 });
      }
      if (punto.observacion) {
        let obs = punto.observacion;
        try {
          const parsed = JSON.parse(punto.observacion) as Record<string, unknown>;
          obs = textoSeguro(parsed.descripcionFinal ?? parsed.justificacionCalificacionIa ?? punto.observacion);
        } catch {}
        line(`Inspector: ${obs}`, { size: 9, indent: 12 });
      }
      y -= 4;
      consecutivo += 1;
    }
  }

  if (inspeccion.hallazgos.length) {
    newPage("Hallazgos y recomendaciones");
    for (const h of inspeccion.hallazgos) {
      const fotosDisponibles = h.fotografias.filter((foto) => Boolean(foto.url));
      const alturaFotos = fotosDisponibles.length ? 150 : 0;
      ensure(130 + alturaFotos, "Hallazgos y recomendaciones");

      page.drawRectangle({ x: M, y: y - 24, width: CONTENT_W, height: 24, color: NAVY });
      page.drawText(`${h.prioridad} · ${h.titulo}`, { x: M + 10, y: y - 16, size: 10, font: bold, color: GOLD });
      y -= 34;
      line(`Área: ${h.area} · Clasificación: ${h.clasificacion}`, { bold: true, size: 9, gap: 3 });
      line(h.descripcion, { size: 9, gap: 3 });
      if (h.recomendacion) line(`Recomendación: ${h.recomendacion}`, { size: 9, gap: 5 });

      if (fotosDisponibles.length) {
        const fotos = fotosDisponibles.slice(0, 4);
        const images = (await Promise.all(fotos.map((foto) => incrustarImagen(pdf, foto.url)))).filter(Boolean) as PDFImage[];
        if (images.length) {
          ensure(148, "Hallazgos y recomendaciones");
          const gap = 8;
          const cols = Math.min(2, images.length);
          const boxW = (CONTENT_W - gap) / 2;
          const boxH = 112;
          for (let i = 0; i < images.length; i += 1) {
            if (i === 2) {
              y -= boxH + 24;
              ensure(boxH + 30, "Hallazgos y recomendaciones");
            }
            const col = i % 2;
            const x = M + col * (boxW + gap);
            dibujarImagenAjustada(page, images[i], x, y - boxH, boxW, boxH);
            const caption = textoSeguro(fotos[i]?.descripcion || `Evidencia fotográfica ${i + 1}`);
            const rows = wrap(caption, regular, 7, boxW).slice(0,2);
            rows.forEach((row, idx) => page.drawText(row, { x: x + 3, y: y - boxH - 10 - idx*9, size: 7, font: regular, color: MUTED }));
          }
          y -= boxH + 26;
        }
      }
      y -= 8;
    }
  }

  newPage("Firmas y cierre documental");
  const firmaInspector = inspeccion.firmas.find((f) => f.tipo.toUpperCase().includes("INSPECTOR"));
  const firmaCliente = inspeccion.firmas.find((f) => f.tipo.toUpperCase().includes("CLIENTE"));
  line("ALCANCE Y CONSIDERACIONES DE LA INSPECCIÓN", { bold: true, size: 11 });
  line("La inspección realizada por Certeza Habitacional consiste en una revisión técnica y visual de las condiciones observables y accesibles del inmueble al momento de la visita, conforme al alcance del servicio contratado. Los resultados corresponden a las condiciones existentes y observables en la fecha y hora de la inspección.", { size: 9 });
  y -= 8;
  line(`Inspector: ${firmaInspector?.nombreFirmante ?? inspeccion.inspector?.usuario.nombre ?? "Inspector asignado"}`, { bold: true });
  line(`Firma registrada: ${firmaInspector?.firmadaEn ? firmaInspector.firmadaEn.toLocaleString("es-MX") : "No disponible"}`);
  y -= 8;
  line(`Cliente: ${firmaCliente?.nombreFirmante ?? inspeccion.cliente.nombre}`, { bold: true });
  line(`Firma registrada: ${firmaCliente?.firmadaEn ? firmaCliente.firmadaEn.toLocaleString("es-MX") : "No disponible"}`);
  y -= 14;
  line(`Código de validación: ${certificado.codigoValidacion}`, { bold: true });

  // CERTIFICADO: última hoja independiente, sin encabezado ni pie del reporte.
  page = pdf.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 18, y: 18, width: PAGE_W - 36, height: PAGE_H - 36, color: NAVY });
  page.drawRectangle({ x: 25, y: 25, width: PAGE_W - 50, height: PAGE_H - 50, color: rgb(1,1,1), borderColor: GOLD, borderWidth: 1.4 });

  page.drawRectangle({ x: 25, y: 642, width: PAGE_W - 50, height: 125, color: NAVY });
  if (logo) {
    const escala = 96 / logo.width;
    page.drawImage(logo, { x: 48, y: 658, width: 96, height: logo.height * escala });
  }
  page.drawText("CERTIFICADO", { x: 170, y: 716, size: 11, font: bold, color: GOLD });
  page.drawText("CERTEZA HABITACIONAL", { x: 170, y: 686, size: 24, font: bold, color: rgb(1,1,1) });
  page.drawText("Resultado final autorizado", { x: 170, y: 664, size: 10, font: regular, color: rgb(0.82,0.85,0.89) });

  page.drawRectangle({ x: 48, y: 570, width: 516, height: 48, color: rgb(0.97,0.97,0.98), borderColor: rgb(0.88,0.73,0.35), borderWidth: 1 });
  page.drawText(certificado.folio, { x: 62, y: 590, size: 14, font: bold, color: NAVY });
  page.drawText(`Inspección ${inspeccion.folio}`, { x: 362, y: 590, size: 10, font: bold, color: MUTED });

  const certRows: Array<[string,string]> = [
    ["CLIENTE", inspeccion.cliente.nombre],
    ["INMUEBLE", inspeccion.inmueble?.alias ?? inspeccion.tipoInmueble],
    ["CALIFICACIÓN TÉCNICA CERTEZA", `${Number(certificado.ish).toFixed(2)} / 100`],
    ["COBERTURA", metricas ? `${metricas.cobertura.toFixed(2)}%` : "—"],
    ["AUTORIZADO POR DIRECCIÓN", inspeccion.revisiones[0]?.usuario.nombre ?? "Dirección Certeza"],
  ];
  let certY = 525;
  for (const [label, value] of certRows) {
    page.drawText(label, { x: 58, y: certY, size: 7.8, font: bold, color: MUTED });
    page.drawText(value, { x: 232, y: certY, size: 11, font: bold, color: NAVY });
    page.drawLine({ start: { x: 58, y: certY - 10 }, end: { x: 366, y: certY - 10 }, thickness: 0.5, color: rgb(0.9,0.91,0.93) });
    certY -= 48;
  }

  const qrPng = await QRCode.toBuffer(
    `${request.nextUrl.origin}/certificados/verificar/${certificado.codigoValidacion}`,
    { width: 220, margin: 1, errorCorrectionLevel: "M", type: "png" },
  );
  const qrImage = await pdf.embedPng(qrPng);
  page.drawRectangle({ x: 392, y: 372, width: 150, height: 176, color: rgb(0.98,0.98,0.99), borderColor: GOLD, borderWidth: 1 });
  page.drawImage(qrImage, { x: 406, y: 401, width: 122, height: 122 });
  page.drawText("VALIDAR CERTIFICADO", { x: 419, y: 385, size: 7.5, font: bold, color: NAVY });

  page.drawText("DICTAMEN", { x: 58, y: 274, size: 9, font: bold, color: GOLD });
  page.drawRectangle({ x: 58, y: 134, width: 484, height: 124, color: rgb(0.98,0.98,0.99), borderColor: rgb(0.91,0.91,0.93), borderWidth: 0.8 });
  const dictamenCert = wrap(certificado.dictamen, regular, 9, 456).slice(0, 8);
  let certTextY = 235;
  for (const row of dictamenCert) {
    page.drawText(row, { x: 72, y: certTextY, size: 9, font: regular, color: SLATE });
    certTextY -= 14;
  }
  page.drawText("DOCUMENTO DISTINTIVO CERTEZA HABITACIONAL", { x: 58, y: 92, size: 8, font: bold, color: GOLD });
  page.drawText(`Código de validación: ${certificado.codigoValidacion}`, { x: 58, y: 74, size: 8, font: bold, color: NAVY });
  page.drawText("La vigencia del certificado puede comprobarse mediante el código QR.", { x: 58, y: 58, size: 7.5, font: regular, color: MUTED });

  const paginas = pdf.getPages();
  paginas.forEach((pagina, indice) => {
    const esPortada = indice === 0;
    const esCertificado = indice === paginas.length - 1;
    if (esPortada || esCertificado) return;

    pagina.drawRectangle({ x: 0, y: PAGE_H - 36, width: PAGE_W, height: 36, color: NAVY });
    if (logo) {
      const escala = 28 / logo.width;
      pagina.drawImage(logo, { x: 34, y: PAGE_H - 33, width: 28, height: logo.height * escala });
    }
    pagina.drawText("CERTEZA HABITACIONAL", { x: 70, y: PAGE_H - 22, size: 8, font: bold, color: GOLD });
    pagina.drawText("Reporte de inspección", { x: 70, y: PAGE_H - 31, size: 6.8, font: regular, color: rgb(1,1,1) });
    pagina.drawText(inspeccion.folio, { x: PAGE_W - 130, y: PAGE_H - 22, size: 8, font: bold, color: rgb(1,1,1) });

    pagina.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 24, color: NAVY });
    const etiqueta = `Pág. ${indice + 1} / ${paginas.length}`;
    pagina.drawText("CH-R-001", { x: 20, y: 8, size: 6.6, font: bold, color: rgb(0.94,0.94,0.95) });
    const centro = `${contacto.email}   |   ${contacto.telefono}   |   ${ADDRESS}`;
    const maxCentro = 370;
    const centroRows = wrap(centro, regular, 5.8, maxCentro);
    pagina.drawText(centroRows[0] ?? centro, { x: 90, y: 8, size: 5.8, font: regular, color: rgb(0.94,0.94,0.95), maxWidth: maxCentro });
    pagina.drawText(etiqueta, { x: PAGE_W - 72, y: 8, size: 6.6, font: bold, color: rgb(0.94,0.94,0.95) });
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
