import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { EstadoCotizacion, Prisma, TipoCliente } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  esZonaServicio,
  obtenerZonaServicio,
  type ZonaServicio,
} from "@/lib/configuracion-zonas";
import {
  generarCotizacionDocxAutorizada,
  generarPreCotizacionPdfAutorizada,
} from "@/lib/cotizacion-documentos-autorizados";

type SolicitudCotizacion = {
  nombre?: string;
  telefono?: string;
  correo?: string;
  tipoCliente?: string;
  empresa?: string;
  ciudadCliente?: string;
  zonaServicio?: string;
  direccionInmueble?: string;
  ciudadInmueble?: string;
  m2Terreno?: string;
  m2Construccion?: string;
  niveles?: string;
  recamaras?: string;
  banos?: string;
  cocina?: boolean;
  sala?: boolean;
  comedor?: boolean;
  estancia?: boolean;
  areaLavado?: boolean;
  lavadero?: boolean;
  cochera?: boolean;
  patio?: boolean;
  jardin?: boolean;
  terraza?: boolean;
  balcon?: boolean;
  sotano?: boolean;
  cuartoServicio?: boolean;
  bodega?: boolean;
  otrosEspacios?: string;
  comentarios?: string;
  avisoPrivacidad?: boolean;
  folioExistente?: string;
};

const espacios = [
  ["cocina", "Cocina"],
  ["sala", "Sala"],
  ["comedor", "Comedor"],
  ["estancia", "Estancia"],
  ["areaLavado", "Área de lavado"],
  ["lavadero", "Lavadero"],
  ["cochera", "Cochera"],
  ["patio", "Patio"],
  ["jardin", "Jardín"],
  ["terraza", "Terraza"],
  ["balcon", "Balcón"],
  ["sotano", "Sótano"],
  ["cuartoServicio", "Cuarto de servicio"],
  ["bodega", "Bodega"],
] as const;

function textoSeguro(valor?: string) {
  return (valor ?? "").trim();
}

function numeroSeguro(valor?: string) {
  const numero = Number(textoSeguro(valor).replace(",", "."));
  return Number.isFinite(numero) && numero >= 0 ? numero : 0;
}

function generarFolioCotizacion() {
  const year = new Date().getFullYear();
  const codigo = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `CH-COT-${year}-${codigo}`;
}

function calcularCotizacionAutomatica(data: SolicitudCotizacion) {
  const superficie = numeroSeguro(data.m2Construccion);
  const niveles = Math.max(1, Math.floor(numeroSeguro(data.niveles) || 1));
  const recamaras = Math.max(0, Math.floor(numeroSeguro(data.recamaras)));
  const banosDeclarados = numeroSeguro(data.banos);
  const banosCompletos = Math.floor(banosDeclarados);
  const mediosBanos = banosDeclarados - banosCompletos >= 0.5 ? 1 : 0;
  const conceptos: Array<{ concepto: string; importe: number }> = [];

  const precioBase = 4000;
  conceptos.push({ concepto: "Precio base de inspección (hasta 55 m²)", importe: precioBase });

  const metrosAdicionales = Math.max(0, superficie - 55);
  if (metrosAdicionales > 0) {
    conceptos.push({
      concepto: `${metrosAdicionales.toFixed(0)} m² adicionales de construcción × $14`,
      importe: metrosAdicionales * 14,
    });
  }

  const banosCompletosAdicionales = Math.max(0, banosCompletos - 1);
  if (banosCompletosAdicionales > 0) {
    conceptos.push({
      concepto: `${banosCompletosAdicionales} baño(s) completo(s) adicional(es)`,
      importe: banosCompletosAdicionales * 250,
    });
  }

  if (mediosBanos > 0) {
    conceptos.push({ concepto: "Medio baño", importe: 150 });
  }

  const nivelesAdicionales = Math.max(0, niveles - 1);
  if (nivelesAdicionales > 0) {
    conceptos.push({
      concepto: `${nivelesAdicionales} nivel(es) adicional(es)`,
      importe: nivelesAdicionales * 250,
    });
  }

  const recamarasAdicionales = Math.max(0, recamaras - 3);
  if (recamarasAdicionales > 0) {
    conceptos.push({
      concepto: `${recamarasAdicionales} recámara(s) adicional(es)`,
      importe: recamarasAdicionales * 75,
    });
  }

  const cargosPorEspacios: Array<[boolean | undefined, string, number]> = [
    [data.areaLavado, "Área de lavado", 100],
    [data.estancia, "Estancia", 50],
    [data.cochera, "Cochera", 50],
    [data.terraza, "Terraza", 75],
    [data.balcon, "Balcón", 75],
    [data.sotano, "Sótano", 200],
    [data.cuartoServicio, "Cuarto de servicio", 75],
    [data.bodega, "Bodega", 50],
  ];

  for (const [incluido, concepto, importe] of cargosPorEspacios) {
    if (incluido) conceptos.push({ concepto, importe });
  }

  const importeTecnico = conceptos.reduce((total, concepto) => total + concepto.importe, 0);
  const totalPropuesto = Math.max(4000, Math.round(importeTecnico / 500) * 500);

  return {
    conceptos,
    importeTecnico,
    totalPropuesto,
    pago50: totalPropuesto / 2,
  };
}

function escaparHtml(valor?: string) {
  return textoSeguro(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(request: Request) {
  try {
    const data = (await request.json()) as SolicitudCotizacion;

    if (
      !textoSeguro(data.nombre) ||
      !textoSeguro(data.telefono) ||
      !textoSeguro(data.correo) ||
      !textoSeguro(data.tipoCliente) ||
      !textoSeguro(data.ciudadCliente) ||
      !data.zonaServicio ||
      !esZonaServicio(data.zonaServicio) ||
      !textoSeguro(data.direccionInmueble) ||
      !textoSeguro(data.ciudadInmueble) ||
      !textoSeguro(data.m2Terreno) ||
      !textoSeguro(data.m2Construccion) ||
      !textoSeguro(data.recamaras) ||
      !textoSeguro(data.banos) ||
      !data.avisoPrivacidad
    ) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos obligatorios para enviar la solicitud." },
        { status: 400 },
      );
    }

    const zonaServicio = data.zonaServicio as ZonaServicio;
    const zona = obtenerZonaServicio(zonaServicio);
    const cotizacion = calcularCotizacionAutomatica(data);
    const seleccionados = espacios
      .filter(([campo]) => Boolean(data[campo]))
      .map(([, etiqueta]) => etiqueta);

    const mapaCodigoZona: Record<ZonaServicio, string> = {
      CIUDAD_JUAREZ: "CDJ",
      GUADALAJARA: "GDL",
      HERMOSILLO: "HMO",
      TIJUANA: "TIJ",
    };

    const zonaDb = await prisma.zona.findUnique({
      where: { codigo: mapaCodigoZona[zonaServicio] },
      select: { id: true, estado: true },
    });

    const snapshot = {
      nombre: data.nombre!,
      telefono: data.telefono!,
      correo: data.correo!,
      tipoCliente: data.tipoCliente!,
      empresa: data.empresa || "",
      ciudadCliente: data.ciudadCliente!,
      zonaServicio,
      direccionInmueble: data.direccionInmueble!,
      ciudadInmueble: data.ciudadInmueble!,
      m2Terreno: data.m2Terreno!,
      m2Construccion: data.m2Construccion!,
      niveles: data.niveles || "",
      recamaras: data.recamaras!,
      banos: data.banos!,
      cocina: Boolean(data.cocina),
      sala: Boolean(data.sala),
      comedor: Boolean(data.comedor),
      estancia: Boolean(data.estancia),
      areaLavado: Boolean(data.areaLavado),
      lavadero: Boolean(data.lavadero),
      cochera: Boolean(data.cochera),
      patio: Boolean(data.patio),
      jardin: Boolean(data.jardin),
      terraza: Boolean(data.terraza),
      balcon: Boolean(data.balcon),
      sotano: Boolean(data.sotano),
      cuartoServicio: Boolean(data.cuartoServicio),
      bodega: Boolean(data.bodega),
      otrosEspacios: data.otrosEspacios || "",
      comentarios: data.comentarios || "",
      avisoPrivacidad: true,
      sitioWeb: "",
    } satisfies Record<string, string | boolean>;

    const folioSolicitado = textoSeguro(data.folioExistente).toUpperCase();
    let folioCotizacion = folioSolicitado || generarFolioCotizacion();
    let versionDocumento = 1;

    if (folioSolicitado) {
      const existente = await prisma.cotizacion.findUnique({
        where: { folio: folioSolicitado },
        include: { cliente: true, inmueble: true },
      });

      const correoCoincide =
        existente?.cliente.correo?.trim().toLowerCase() === data.correo!.trim().toLowerCase();

      const estadosEditables = new Set<EstadoCotizacion>([
        EstadoCotizacion.BORRADOR,
        EstadoCotizacion.PENDIENTE_AUTORIZACION,
        EstadoCotizacion.ENVIADA,
      ]);

      if (
        !existente ||
        !existente.origenPublico ||
        !correoCoincide ||
        !existente.editablePublica ||
        !estadosEditables.has(existente.estado)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "La pre-cotización ya no puede modificarse o los datos de acceso no coinciden.",
          },
          { status: 409 },
        );
      }

      versionDocumento = existente.versionActual + 1;
      folioCotizacion = existente.folio;

      await prisma.$transaction(async (tx) => {
        await tx.cliente.update({
          where: { id: existente.clienteId },
          data: {
            nombre: data.nombre!,
            telefono: data.telefono!,
            correo: data.correo!,
            tipo: data.tipoCliente as TipoCliente,
            empresa: data.empresa || null,
            ciudad: data.ciudadCliente!,
          },
        });

        if (existente.inmuebleId) {
          await tx.inmueble.update({
            where: { id: existente.inmuebleId },
            data: {
              alias: data.direccionInmueble!,
              direccion: data.direccionInmueble!,
              ciudad: data.ciudadInmueble!,
              estado: zonaDb?.estado || existente.inmueble?.estado || "",
              superficieTerrenoM2: new Prisma.Decimal(numeroSeguro(data.m2Terreno)),
              superficieConstruccionM2: new Prisma.Decimal(numeroSeguro(data.m2Construccion)),
            },
          });
        }

        await tx.cotizacion.update({
          where: { id: existente.id },
          data: {
            zonaId: zonaDb?.id ?? existente.zonaId,
            superficieM2: new Prisma.Decimal(numeroSeguro(data.m2Construccion)),
            precioBase: new Prisma.Decimal(4000),
            metrosAdicionales: new Prisma.Decimal(
              Math.max(0, numeroSeguro(data.m2Construccion) - 55),
            ),
            cargoMetrosAdicionales: new Prisma.Decimal(
              Math.max(0, numeroSeguro(data.m2Construccion) - 55) * 14,
            ),
            cargosExtra: new Prisma.Decimal(
              Math.max(
                0,
                cotizacion.importeTecnico -
                  4000 -
                  Math.max(0, numeroSeguro(data.m2Construccion) - 55) * 14,
              ),
            ),
            subtotal: new Prisma.Decimal(cotizacion.importeTecnico),
            total: new Prisma.Decimal(cotizacion.totalPropuesto),
            versionActual: versionDocumento,
            estado: EstadoCotizacion.ENVIADA,
            notas: data.comentarios || null,
          },
        });

        await tx.cotizacionVersion.create({
          data: {
            cotizacionId: existente.id,
            version: versionDocumento,
            datos: snapshot as Prisma.InputJsonValue,
            total: new Prisma.Decimal(cotizacion.totalPropuesto),
          },
        });
      });
    } else {
      const registro = await prisma.$transaction(async (tx) => {
        let cliente = await tx.cliente.findFirst({
          where: {
            correo: {
              equals: data.correo!,
              mode: "insensitive",
            },
          },
        });

        if (cliente) {
          cliente = await tx.cliente.update({
            where: { id: cliente.id },
            data: {
              nombre: data.nombre!,
              telefono: data.telefono!,
              tipo: data.tipoCliente as TipoCliente,
              empresa: data.empresa || null,
              ciudad: data.ciudadCliente!,
            },
          });
        } else {
          cliente = await tx.cliente.create({
            data: {
              nombre: data.nombre!,
              telefono: data.telefono!,
              correo: data.correo!,
              tipo: data.tipoCliente as TipoCliente,
              empresa: data.empresa || null,
              ciudad: data.ciudadCliente!,
            },
          });
        }

        const inmueble = await tx.inmueble.create({
          data: {
            clienteId: cliente.id,
            alias: data.direccionInmueble!,
            tipo: "VIVIENDA",
            direccion: data.direccionInmueble!,
            ciudad: data.ciudadInmueble!,
            estado: zonaDb?.estado || "",
            superficieTerrenoM2: new Prisma.Decimal(numeroSeguro(data.m2Terreno)),
            superficieConstruccionM2: new Prisma.Decimal(numeroSeguro(data.m2Construccion)),
          },
        });

        const nueva = await tx.cotizacion.create({
          data: {
            folio: folioCotizacion,
            clienteId: cliente.id,
            inmuebleId: inmueble.id,
            zonaId: zonaDb?.id,
            origenPublico: true,
            editablePublica: true,
            versionActual: 1,
            superficieM2: new Prisma.Decimal(numeroSeguro(data.m2Construccion)),
            precioBase: new Prisma.Decimal(4000),
            metrosAdicionales: new Prisma.Decimal(
              Math.max(0, numeroSeguro(data.m2Construccion) - 55),
            ),
            cargoMetrosAdicionales: new Prisma.Decimal(
              Math.max(0, numeroSeguro(data.m2Construccion) - 55) * 14,
            ),
            cargosExtra: new Prisma.Decimal(
              Math.max(
                0,
                cotizacion.importeTecnico -
                  4000 -
                  Math.max(0, numeroSeguro(data.m2Construccion) - 55) * 14,
              ),
            ),
            subtotal: new Prisma.Decimal(cotizacion.importeTecnico),
            total: new Prisma.Decimal(cotizacion.totalPropuesto),
            estado: EstadoCotizacion.ENVIADA,
            notas: data.comentarios || null,
          },
        });

        await tx.cotizacionVersion.create({
          data: {
            cotizacionId: nueva.id,
            version: 1,
            datos: snapshot as Prisma.InputJsonValue,
            total: new Prisma.Decimal(cotizacion.totalPropuesto),
          },
        });

        return nueva;
      });

      versionDocumento = registro.versionActual;
    }

    const fechaEmision = new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Ciudad_Juarez",
    }).format(new Date());

    const datosDocumento = {
      folio: folioCotizacion,
      fecha: fechaEmision,
      nombre: data.nombre!,
      telefono: data.telefono!,
      correo: data.correo!,
      tipoCliente: data.tipoCliente!,
      zona: zonaServicio,
      direccionInmueble: data.direccionInmueble!,
      ciudadInmueble: data.ciudadInmueble!,
      m2Terreno: data.m2Terreno!,
      m2Construccion: data.m2Construccion!,
      niveles: data.niveles || "",
      recamaras: data.recamaras!,
      banos: data.banos!,
      espacios: seleccionados,
      otrosEspacios: data.otrosEspacios || "",
      comentarios: data.comentarios || "",
      totalPropuesto: cotizacion.totalPropuesto,
      pago50: cotizacion.pago50,
    };

    let pdfBase64 = "";
    let documentoDisponible = false;

    try {
      const pdf = await generarPreCotizacionPdfAutorizada(datosDocumento);
      const pdfBytes = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
      pdfBase64 = pdfBytes.toString("base64");
      documentoDisponible = true;
    } catch (errorDocumento) {
      console.error("Cotización guardada, pero no fue posible generar el PDF:", errorDocumento);
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    let correoEnviado = false;

    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const remitente =
        process.env.COTIZACIONES_FROM_EMAIL ||
        "Certeza Habitacional <cotizaciones@certezahabitacional.com>";
      const adminEmail =
        process.env.ADMIN_COTIZACIONES_EMAIL || "contacto@certezahabitacional.com";

      try {
        const tareasCorreo: Array<Promise<unknown>> = [];

        try {
          const docxInterno = await generarCotizacionDocxAutorizada(datosDocumento);
          tareasCorreo.push(
            resend.emails.send({
              from: remitente,
              to: [adminEmail],
              replyTo: data.correo!,
              subject: `Nueva solicitud de cotización - ${data.nombre} - ${data.ciudadInmueble}`,
              html: `<div style="font-family:Arial,sans-serif"><h2>Certeza Habitacional</h2><p>Nueva solicitud pública recibida.</p><p><strong>Folio:</strong> ${folioCotizacion}</p><p><strong>Cliente:</strong> ${escaparHtml(data.nombre)}</p><p><strong>Correo:</strong> ${escaparHtml(data.correo)}</p><p><strong>Inmueble:</strong> ${escaparHtml(data.direccionInmueble)}, ${escaparHtml(data.ciudadInmueble)}</p><p><strong>Total preliminar:</strong> ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cotizacion.totalPropuesto)}</p></div>`,
              attachments: [
                {
                  filename: `Cotizacion_${folioCotizacion}.docx`,
                  content: docxInterno,
                },
              ],
            }),
          );
        } catch (errorDocx) {
          console.error("No fue posible generar el DOCX interno; la solicitud permanece registrada:", errorDocx);
        }

        if (documentoDisponible && pdfBase64) {
          const pdfBytes = Buffer.from(pdfBase64, "base64");
          const archivo = `${folioCotizacion}-PRE-COTIZACION.pdf`;
          const asuntoCliente = `Pre cotización Certeza Habitacional - ${folioCotizacion}`;
          const htmlCliente = `<div style="font-family:Arial,Helvetica,sans-serif;color:#101828;line-height:1.6"><h2 style="color:#071a2a">Certeza Habitacional</h2><p>Hola ${escaparHtml(data.nombre)},</p><p>Adjuntamos la <strong>PRE COTIZACIÓN</strong> generada con base en la información que proporcionaste.</p><p>Folio: <strong>${folioCotizacion}</strong></p><p>Atentamente,<br>Certeza Habitacional</p></div>`;

          tareasCorreo.push(
            resend.emails.send({
              from: remitente,
              to: [data.correo!],
              subject: asuntoCliente,
              html: htmlCliente,
              attachments: [{ filename: archivo, content: pdfBytes }],
            }),
          );

          if (
            zona.correoCotizacion &&
            zona.correoCotizacion.toLowerCase() !== data.correo!.toLowerCase()
          ) {
            tareasCorreo.push(
              resend.emails.send({
                from: remitente,
                to: [zona.correoCotizacion],
                subject: `${asuntoCliente} - ${zona.nombre}`,
                html: htmlCliente,
                attachments: [{ filename: archivo, content: pdfBytes }],
              }),
            );
          }
        }

        if (tareasCorreo.length > 0) {
          const resultados = await Promise.allSettled(tareasCorreo);
          correoEnviado = resultados.some((resultado) => resultado.status === "fulfilled");
          for (const resultado of resultados) {
            if (resultado.status === "rejected") {
              console.error("Correo de cotización no enviado; la solicitud permanece registrada:", resultado.reason);
            }
          }
        }
      } catch (errorCorreo) {
        console.error("Fallo no bloqueante de correo; la solicitud permanece registrada:", errorCorreo);
      }
    } else {
      console.error("RESEND_API_KEY no configurada; la solicitud quedó registrada sin envío de correo.");
    }

    return NextResponse.json({
      ok: true,
      cotizacion: {
        folio: folioCotizacion,
        version: versionDocumento,
        totalPropuesto: cotizacion.totalPropuesto,
        pdfBase64,
        zona: zona.nombre,
      },
      documentoDisponible,
      correoEnviado,
      aviso:
        !correoEnviado || !documentoDisponible
          ? "La solicitud quedó registrada. Si algún envío o documento no estuvo disponible, el equipo de Certeza Habitacional podrá darle seguimiento desde el sistema."
          : null,
    });
  } catch (error) {
    console.error("Error en /api/solicitudes-cotizacion:", error);
    return NextResponse.json(
      { ok: false, error: "Ocurrió un error interno al registrar la solicitud." },
      { status: 500 },
    );
  }
}
