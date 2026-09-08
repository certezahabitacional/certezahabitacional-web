import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

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

function textoSeguro(valor?: string) {
  return (valor ?? "").trim();
}

function numeroSeguro(valor?: string) {
  const normalizado = textoSeguro(valor).replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero >= 0 ? numero : 0;
}

function dinero(valor: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(valor);
}

function escaparHtml(valor?: string) {
  return textoSeguro(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
  conceptos.push({
    concepto: "Precio base de inspección (hasta 55 m²)",
    importe: precioBase,
  });

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
    conceptos.push({
      concepto: "Medio baño",
      importe: mediosBanos * 150,
    });
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
    if (incluido) {
      conceptos.push({ concepto, importe });
    }
  }

  const importeTecnico = conceptos.reduce((total, concepto) => total + concepto.importe, 0);

  // Redondeo comercial a bloques de $500 para mantener una propuesta clara y
  // consistente con los casos de referencia definidos por Certeza Habitacional.
  const totalPropuesto = Math.max(4000, Math.round(importeTecnico / 500) * 500);

  return {
    superficie,
    niveles,
    recamaras,
    banosCompletos,
    mediosBanos,
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
      !textoSeguro(data.nombre) ||
      !textoSeguro(data.telefono) ||
      !textoSeguro(data.correo) ||
      !textoSeguro(data.tipoCliente) ||
      !textoSeguro(data.ciudadCliente) ||
      !textoSeguro(data.direccionInmueble) ||
      !textoSeguro(data.ciudadInmueble) ||
      !textoSeguro(data.m2Terreno) ||
      !textoSeguro(data.m2Construccion) ||
      !textoSeguro(data.recamaras) ||
      !textoSeguro(data.banos) ||
      !data.avisoPrivacidad
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Faltan datos obligatorios para enviar la solicitud.",
        },
        { status: 400 },
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    const adminEmail =
      process.env.ADMIN_COTIZACIONES_EMAIL ||
      "contacto@certezahabitacional.com";

    const remitente =
      process.env.COTIZACIONES_FROM_EMAIL ||
      "Certeza Habitacional <cotizaciones@certezahabitacional.com>";

    if (!resendApiKey) {
      console.error("Falta RESEND_API_KEY en las variables de entorno.");

      return NextResponse.json(
        {
          ok: false,
          error: "El servicio de correo no está configurado.",
        },
        { status: 503 },
      );
    }

    const seleccionados = espacios
      .filter(([campo]) => Boolean(data[campo]))
      .map(([, etiqueta]) => etiqueta);

    const cotizacion = calcularCotizacionAutomatica(data);
    const folioCotizacion = generarFolioCotizacion();

    const asunto =
      `Nueva solicitud de cotización - ${data.nombre} - ${data.ciudadInmueble}`;

    const desgloseTexto = cotizacion.conceptos
      .map((item) => `- ${item.concepto}: ${dinero(item.importe)}`)
      .join("\n");

    const texto = `
NUEVA SOLICITUD DE COTIZACIÓN
CERTEZA HABITACIONAL

============================================================
1. SOLICITUD RECIBIDA
============================================================

DATOS DEL CLIENTE

Nombre:
${data.nombre}

Teléfono / WhatsApp:
${data.telefono}

Correo:
${data.correo}

Tipo de cliente:
${data.tipoCliente}

Empresa:
${data.empresa || "No aplica"}

Ciudad:
${data.ciudadCliente}

DATOS DEL INMUEBLE

Dirección:
${data.direccionInmueble}

Ciudad:
${data.ciudadInmueble}

m² de terreno:
${data.m2Terreno}

m² de construcción:
${data.m2Construccion}

Número de niveles:
${data.niveles || "No indicado"}

Número de recámaras:
${data.recamaras}

Número de baños:
${data.banos}

ESPACIOS DE LA VIVIENDA

${seleccionados.length ? seleccionados.join(", ") : "No se seleccionaron espacios."}

OTROS ESPACIOS O CARACTERÍSTICAS

${data.otrosEspacios || "Ninguno"}

COMENTARIOS DEL CLIENTE

${data.comentarios || "Sin comentarios adicionales"}

AVISO DE PRIVACIDAD
Aceptado: Sí

============================================================
2. COTIZACIÓN AUTOMÁTICA PRELIMINAR
============================================================

Folio: ${folioCotizacion}

Desglose interno de cálculo:
${desgloseTexto}

Importe técnico calculado: ${dinero(cotizacion.importeTecnico)}
TOTAL PROPUESTO: ${dinero(cotizacion.totalPropuesto)}

Nota de facturación:
En caso de requerir factura, al importe anterior se adicionará el IVA correspondiente.

Modalidades de pago disponibles:
1) Pago único de ${dinero(cotizacion.totalPropuesto)} al contratar la inspección.
2) Dos pagos del 50%: ${dinero(cotizacion.pago50)} al contratar y ${dinero(cotizacion.pago50)} antes de iniciar la inspección.

Alcance instrumental preliminar sujeto a revisión antes de enviar al cliente:
- Cámara térmica.
- Probador de contactos GFCI/RCD.
- Detector de voltaje sin contacto.
- Multímetro profesional.
- Nivel láser autonivelante.
- Medidor láser de distancia.
- Martillo/rodillo de auscultación.
- Linterna LED profesional.
- Manómetro para agua.
- Detector de gas combustible.
- Prueba de hermeticidad hidráulica, cuando las condiciones del inmueble permitan realizarla de forma segura.
- Prueba de hermeticidad de gas, cuando las condiciones del inmueble permitan realizarla de forma segura.

IMPORTANTE
Esta cotización es una propuesta automática para revisión interna. No se envía al cliente como cotización definitiva hasta que Certeza Habitacional confirme alcance, disponibilidad de equipo, modalidad de pago y cualquier ajuste o descuento comercial.
`.trim();

    const filasDesgloseHtml = cotizacion.conceptos
      .map(
        (item) => `
          <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escaparHtml(item.concepto)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">${dinero(item.importe)}</td>
          </tr>`,
      )
      .join("");

    const html = `
      <div style="margin:0;background:#f4f4f1;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#101828;">
        <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #d8d8d8;">
          <div style="background:#071a2a;color:#ffffff;padding:22px 26px;border-bottom:5px solid #d9a72e;">
            <div style="font-size:22px;font-weight:700;letter-spacing:.4px;">CERTEZA HABITACIONAL</div>
            <div style="margin-top:5px;color:#f1c65b;font-size:13px;font-weight:700;">Solicitud + cotización automática preliminar</div>
          </div>

          <div style="padding:24px 26px;">
            <h2 style="margin:0 0 14px;font-size:18px;color:#071a2a;">1. Solicitud recibida</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.4;">
              <tr><td style="padding:6px 0;font-weight:700;width:34%;">Cliente</td><td>${escaparHtml(data.nombre)}</td></tr>
              <tr><td style="padding:6px 0;font-weight:700;">Teléfono / WhatsApp</td><td>${escaparHtml(data.telefono)}</td></tr>
              <tr><td style="padding:6px 0;font-weight:700;">Correo</td><td>${escaparHtml(data.correo)}</td></tr>
              <tr><td style="padding:6px 0;font-weight:700;">Tipo de cliente</td><td>${escaparHtml(data.tipoCliente)}</td></tr>
              <tr><td style="padding:6px 0;font-weight:700;">Dirección del inmueble</td><td>${escaparHtml(data.direccionInmueble)}</td></tr>
              <tr><td style="padding:6px 0;font-weight:700;">Ciudad</td><td>${escaparHtml(data.ciudadInmueble)}</td></tr>
              <tr><td style="padding:6px 0;font-weight:700;">Terreno</td><td>${escaparHtml(data.m2Terreno)} m²</td></tr>
              <tr><td style="padding:6px 0;font-weight:700;">Construcción</td><td>${escaparHtml(data.m2Construccion)} m²</td></tr>
              <tr><td style="padding:6px 0;font-weight:700;">Niveles</td><td>${escaparHtml(data.niveles || "No indicado")}</td></tr>
              <tr><td style="padding:6px 0;font-weight:700;">Recámaras</td><td>${escaparHtml(data.recamaras)}</td></tr>
              <tr><td style="padding:6px 0;font-weight:700;">Baños</td><td>${escaparHtml(data.banos)}</td></tr>
              <tr><td style="padding:6px 0;font-weight:700;">Espacios declarados</td><td>${escaparHtml(seleccionados.length ? seleccionados.join(", ") : "No se seleccionaron espacios")}</td></tr>
              <tr><td style="padding:6px 0;font-weight:700;">Otros espacios</td><td>${escaparHtml(data.otrosEspacios || "Ninguno")}</td></tr>
              <tr><td style="padding:6px 0;font-weight:700;">Comentarios</td><td>${escaparHtml(data.comentarios || "Sin comentarios adicionales")}</td></tr>
            </table>

            <div style="height:1px;background:#d8d8d8;margin:24px 0;"></div>

            <h2 style="margin:0 0 14px;font-size:18px;color:#071a2a;">2. Cotización automática preliminar</h2>
            <div style="font-size:13px;margin-bottom:12px;"><strong>Folio:</strong> ${folioCotizacion}</div>

            <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb;">
              <thead>
                <tr style="background:#d9a72e;color:#111827;">
                  <th style="padding:9px 10px;text-align:left;">Concepto interno de cálculo</th>
                  <th style="padding:9px 10px;text-align:right;">Importe</th>
                </tr>
              </thead>
              <tbody>${filasDesgloseHtml}</tbody>
            </table>

            <div style="margin-top:16px;padding:16px 18px;background:#fff8e5;border-left:5px solid #d9a72e;">
              <div style="font-size:12px;color:#475467;">Importe técnico calculado: ${dinero(cotizacion.importeTecnico)}</div>
              <div style="margin-top:4px;font-size:22px;font-weight:800;color:#071a2a;">TOTAL PROPUESTO: ${dinero(cotizacion.totalPropuesto)}</div>
              <div style="margin-top:8px;font-size:12px;line-height:1.45;">En caso de requerir factura, al importe anterior se adicionará el IVA correspondiente.</div>
            </div>

            <h3 style="margin:22px 0 8px;font-size:15px;color:#071a2a;">Modalidades de pago</h3>
            <div style="font-size:13px;line-height:1.6;">
              <div>1. Pago único de <strong>${dinero(cotizacion.totalPropuesto)}</strong> al contratar la inspección.</div>
              <div>2. Dos pagos del 50%: <strong>${dinero(cotizacion.pago50)}</strong> al contratar y <strong>${dinero(cotizacion.pago50)}</strong> antes de iniciar la inspección.</div>
            </div>

            <h3 style="margin:22px 0 8px;font-size:15px;color:#071a2a;">Servicios instrumentales preliminares</h3>
            <div style="font-size:13px;line-height:1.6;color:#344054;">
              Cámara térmica · Probador GFCI/RCD · Detector de voltaje · Multímetro · Nivel láser · Medidor láser · Martillo/rodillo de auscultación · Linterna profesional · Manómetro para agua · Detector de gas combustible · Prueba de hermeticidad hidráulica · Prueba de hermeticidad de gas.
            </div>

            <div style="margin-top:22px;padding:13px 15px;background:#f2f4f7;font-size:12px;line-height:1.5;color:#475467;">
              <strong>Revisión interna obligatoria:</strong> esta propuesta automática no se envía al cliente como cotización definitiva. Antes de enviarla deben confirmarse alcance, disponibilidad de equipo, modalidad de pago y cualquier ajuste o descuento comercial.
            </div>
          </div>

          <div style="background:#071a2a;color:#ffffff;padding:14px 26px;text-align:center;font-size:11px;line-height:1.5;">
            contacto@certezahabitacional.com · 656 287 12 18 · Monte Apeninos 6436, Col. La Cuesta, Ciudad Juárez, Chihuahua
          </div>
        </div>
      </div>
    `;

    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remitente,
        to: [adminEmail],
        reply_to: data.correo,
        subject: asunto,
        text: texto,
        html,
      }),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text();

      console.error("Resend rechazó el correo:", detalle);

      return NextResponse.json(
        {
          ok: false,
          error: "No fue posible enviar el correo de la solicitud.",
        },
        { status: 502 },
      );
    }

    const resultado = await respuesta.json();

    return NextResponse.json({
      ok: true,
      id: resultado?.id ?? null,
      cotizacion: {
        folio: folioCotizacion,
        totalPropuesto: cotizacion.totalPropuesto,
      },
    });
  } catch (error) {
    console.error("Error en /api/solicitudes-cotizacion:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Ocurrió un error interno al enviar la solicitud.",
      },
      { status: 500 },
    );
  }
}
