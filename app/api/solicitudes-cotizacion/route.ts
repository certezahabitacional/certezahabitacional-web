import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { crearCotizacionWordEditable } from "@/lib/cotizacion-word";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SolicitudCotizacion = {
  nombre?: string;
  telefono?: string;
  correo?: string;
  tipoCliente?: string;
  empresa?: string;
  ciudadCliente?: string;
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

function texto(valor?: string) {
  return (valor ?? "").trim();
}

function numero(valor?: string) {
  const n = Number(texto(valor).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function dinero(valor: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(valor);
}

function escaparHtml(valor?: string) {
  return texto(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function generarFolio() {
  return `CH-COT-${new Date().getFullYear()}-${randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase()}`;
}

function calcularCotizacion(data: SolicitudCotizacion) {
  const superficie = numero(data.m2Construccion);
  const niveles = Math.max(1, Math.floor(numero(data.niveles) || 1));
  const recamaras = Math.max(0, Math.floor(numero(data.recamaras)));
  const banos = numero(data.banos);
  const completos = Math.floor(banos);
  const medioBano = banos - completos >= 0.5;

  const conceptos: Array<{ concepto: string; importe: number }> = [
    { concepto: "Precio base de inspección (hasta 55 m²)", importe: 4000 },
  ];

  const metrosAdicionales = Math.max(0, superficie - 55);
  if (metrosAdicionales > 0) {
    conceptos.push({
      concepto: `${metrosAdicionales.toFixed(0)} m² adicionales de construcción × $14`,
      importe: metrosAdicionales * 14,
    });
  }

  const banosAdicionales = Math.max(0, completos - 1);
  if (banosAdicionales > 0) {
    conceptos.push({
      concepto: `${banosAdicionales} baño(s) completo(s) adicional(es)`,
      importe: banosAdicionales * 250,
    });
  }

  if (medioBano) conceptos.push({ concepto: "Medio baño", importe: 150 });

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

  const cargos: Array<[boolean | undefined, string, number]> = [
    [data.areaLavado, "Área de lavado", 100],
    [data.estancia, "Estancia", 50],
    [data.cochera, "Cochera", 50],
    [data.terraza, "Terraza", 75],
    [data.balcon, "Balcón", 75],
    [data.sotano, "Sótano", 200],
    [data.cuartoServicio, "Cuarto de servicio", 75],
    [data.bodega, "Bodega", 50],
  ];

  for (const [incluido, concepto, importe] of cargos) {
    if (incluido) conceptos.push({ concepto, importe });
  }

  const importeTecnico = conceptos.reduce((suma, item) => suma + item.importe, 0);
  const totalPropuesto = Math.max(4000, Math.round(importeTecnico / 500) * 500);

  return {
    conceptos,
    importeTecnico,
    totalPropuesto,
    pago50: totalPropuesto / 2,
  };
}

export async function POST(request: Request) {
  try {
    const data = (await request.json()) as SolicitudCotizacion;

    if (
      !texto(data.nombre) ||
      !texto(data.telefono) ||
      !texto(data.correo) ||
      !texto(data.tipoCliente) ||
      !texto(data.ciudadCliente) ||
      !texto(data.direccionInmueble) ||
      !texto(data.ciudadInmueble) ||
      !texto(data.m2Terreno) ||
      !texto(data.m2Construccion) ||
      !texto(data.recamaras) ||
      !texto(data.banos) ||
      !data.avisoPrivacidad
    ) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos obligatorios para enviar la solicitud." },
        { status: 400 },
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const adminEmail =
      process.env.ADMIN_COTIZACIONES_EMAIL || "contacto@certezahabitacional.com";
    const remitente =
      process.env.COTIZACIONES_FROM_EMAIL ||
      "Certeza Habitacional <cotizaciones@certezahabitacional.com>";

    if (!resendApiKey) {
      return NextResponse.json(
        { ok: false, error: "El servicio de correo no está configurado." },
        { status: 503 },
      );
    }

    const areasDeclaradas = espacios
      .filter(([campo]) => Boolean(data[campo]))
      .map(([, etiqueta]) => etiqueta);

    const cotizacion = calcularCotizacion(data);
    const folio = generarFolio();
    const fechaEmision = new Intl.DateTimeFormat("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Chihuahua",
    }).format(new Date());

    const nombreArchivo = `Cotizacion_${folio}.docx`;
    let docx: Buffer | null = null;
    let errorDocumento = "";

    try {
      docx = crearCotizacionWordEditable({
        folio,
        fecha: fechaEmision,
        vigenciaDias: 15,
        cliente: texto(data.nombre),
        telefono: texto(data.telefono),
        correo: texto(data.correo),
        tipoCliente: texto(data.tipoCliente),
        direccion: texto(data.direccionInmueble),
        ciudad: texto(data.ciudadInmueble),
        terrenoM2: texto(data.m2Terreno),
        construccionM2: texto(data.m2Construccion),
        niveles: texto(data.niveles) || "1",
        recamaras: texto(data.recamaras),
        banos: texto(data.banos),
        espacios: areasDeclaradas,
        otrosEspacios: texto(data.otrosEspacios),
        comentarios: texto(data.comentarios),
        total: cotizacion.totalPropuesto,
        pago50: cotizacion.pago50,
      });
    } catch (error) {
      errorDocumento = error instanceof Error ? error.message : "Error desconocido";
      console.error("No fue posible generar el DOCX CH-F-002:", error);
    }

    const desglose = cotizacion.conceptos
      .map((item) => `- ${item.concepto}: ${dinero(item.importe)}`)
      .join("\n");

    const asunto = `Nueva solicitud de cotización - ${texto(data.nombre)} - ${texto(
      data.ciudadInmueble,
    )}`;

    const avisoDocumento = docx
      ? `Se adjunta ${nombreArchivo}, en formato Word DOCX editable y con el formato autorizado CH-F-002. Debe revisarse internamente antes de enviarse al cliente.`
      : `ATENCIÓN INTERNA: la solicitud sí fue recibida, pero el archivo DOCX no pudo generarse automáticamente. Diagnóstico: ${errorDocumento || "DOCX no disponible"}. Preparar la cotización manualmente antes de responder al cliente.`;

    const cuerpoTexto = `
NUEVA SOLICITUD DE COTIZACIÓN
CERTEZA HABITACIONAL

DATOS DEL CLIENTE
Nombre: ${texto(data.nombre)}
Teléfono / WhatsApp: ${texto(data.telefono)}
Correo: ${texto(data.correo)}
Tipo de cliente: ${texto(data.tipoCliente)}
Empresa: ${texto(data.empresa) || "No aplica"}
Ciudad: ${texto(data.ciudadCliente)}

DATOS DEL INMUEBLE
Dirección: ${texto(data.direccionInmueble)}
Ciudad: ${texto(data.ciudadInmueble)}
m² de terreno: ${texto(data.m2Terreno)}
m² de construcción: ${texto(data.m2Construccion)}
Niveles: ${texto(data.niveles) || "1"}
Recámaras: ${texto(data.recamaras)}
Baños: ${texto(data.banos)}

ÁREAS DECLARADAS
${areasDeclaradas.length ? areasDeclaradas.join(", ") : "Ninguna"}

OTROS ESPACIOS / CARACTERÍSTICAS
${texto(data.otrosEspacios) || "Ninguno"}

COMENTARIOS
${texto(data.comentarios) || "Sin comentarios adicionales"}

COTIZACIÓN AUTOMÁTICA PRELIMINAR
Folio: ${folio}
${desglose}
Importe técnico: ${dinero(cotizacion.importeTecnico)}
TOTAL PROPUESTO: ${dinero(cotizacion.totalPropuesto)}

En caso de requerir factura, al importe anterior se adicionará el IVA correspondiente.

${avisoDocumento}
`.trim();

    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f1;padding:24px;color:#101828">
  <div style="max-width:760px;margin:auto;background:#fff;border:1px solid #d8d8d8">
    <div style="background:#071a2a;color:#fff;padding:22px 26px;border-bottom:5px solid #d9a72e">
      <div style="font-size:22px;font-weight:700">CERTEZA HABITACIONAL</div>
      <div style="color:#f1c65b;font-size:13px;font-weight:700;margin-top:5px">Solicitud recibida + cotización preliminar editable</div>
    </div>
    <div style="padding:24px 26px;font-size:14px;line-height:1.55">
      <h2 style="color:#071a2a">Solicitud recibida</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="font-weight:700;padding:5px 0;width:34%">Cliente</td><td>${escaparHtml(data.nombre)}</td></tr>
        <tr><td style="font-weight:700;padding:5px 0">Teléfono</td><td>${escaparHtml(data.telefono)}</td></tr>
        <tr><td style="font-weight:700;padding:5px 0">Correo</td><td>${escaparHtml(data.correo)}</td></tr>
        <tr><td style="font-weight:700;padding:5px 0">Inmueble</td><td>${escaparHtml(data.direccionInmueble)}</td></tr>
        <tr><td style="font-weight:700;padding:5px 0">Ciudad</td><td>${escaparHtml(data.ciudadInmueble)}</td></tr>
        <tr><td style="font-weight:700;padding:5px 0">Construcción</td><td>${escaparHtml(data.m2Construccion)} m²</td></tr>
      </table>
      <div style="margin:22px 0;border-top:1px solid #ddd"></div>
      <h2 style="color:#071a2a">Cotización preliminar</h2>
      <p><strong>Folio:</strong> ${folio}</p>
      <p style="font-size:22px;font-weight:800;color:#071a2a">TOTAL PROPUESTO: ${dinero(
        cotizacion.totalPropuesto,
      )}</p>
      <p>En caso de requerir factura, al importe anterior se adicionará el IVA correspondiente.</p>
      <div style="margin-top:20px;padding:14px;background:${docx ? "#fff8e5" : "#fff0f0"};border-left:5px solid ${docx ? "#d9a72e" : "#b42318"}">
        <strong>${docx ? "Archivo editable adjunto:" : "Atención interna:"}</strong> ${
          docx
            ? `${nombreArchivo}<br>Es un archivo DOCX real basado en el formato autorizado CH-F-002. Revisar alcance, herramientas, forma de pago y cualquier ajuste antes de enviarlo al cliente.`
            : `La solicitud fue recibida correctamente, pero el DOCX no pudo generarse. Diagnóstico: ${escaparHtml(errorDocumento || "DOCX no disponible")}.`
        }
      </div>
    </div>
    <div style="background:#071a2a;color:#fff;padding:14px 26px;text-align:center;font-size:11px">contacto@certezahabitacional.com · 656 287 12 18 · Monte Apeninos 6436, Col. La Cuesta, Ciudad Juárez, Chihuahua</div>
  </div>
</div>`;

    const payloadCorreo: Record<string, unknown> = {
      from: remitente,
      to: [adminEmail],
      reply_to: texto(data.correo),
      subject: asunto,
      text: cuerpoTexto,
      html,
    };

    if (docx) {
      payloadCorreo.attachments = [
        {
          filename: nombreArchivo,
          content: docx.toString("base64"),
        },
      ];
    }

    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payloadCorreo),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      console.error("Resend rechazó el correo:", detalle);
      return NextResponse.json(
        {
          ok: false,
          error: "No fue posible enviar el correo de la solicitud.",
          codigo: "RESEND_SEND_FAILED",
        },
        { status: 502 },
      );
    }

    const resultado = await respuesta.json();

    return NextResponse.json({
      ok: true,
      id: resultado?.id ?? null,
      cotizacion: {
        folio,
        totalPropuesto: cotizacion.totalPropuesto,
        archivoEditable: docx ? nombreArchivo : null,
      },
      advertencia: docx
        ? null
        : "La solicitud fue enviada, pero la cotización DOCX requiere generación manual.",
    });
  } catch (error) {
    console.error("Error en /api/solicitudes-cotizacion:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Ocurrió un error interno al enviar la solicitud.",
        codigo: "SOLICITUD_INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}
