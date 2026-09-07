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
      console.error(
        "Falta RESEND_API_KEY en las variables de entorno.",
      );

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

    const asunto =
      `Nueva solicitud de cotización - ${data.nombre} - ${data.ciudadInmueble}`;

    const texto = `
NUEVA SOLICITUD DE COTIZACIÓN
CERTEZA HABITACIONAL

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

${
  seleccionados.length
    ? seleccionados.join(", ")
    : "No se seleccionaron espacios."
}


OTROS ESPACIOS O CARACTERÍSTICAS

${data.otrosEspacios || "Ninguno"}


COMENTARIOS DEL CLIENTE

${data.comentarios || "Sin comentarios adicionales"}


AVISO DE PRIVACIDAD

Aceptado: Sí
`.trim();

    const respuesta = await fetch(
      "https://api.resend.com/emails",
      {
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
        }),
      },
    );

    if (!respuesta.ok) {
      const detalle = await respuesta.text();

      console.error(
        "Resend rechazó el correo:",
        detalle,
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            "No fue posible enviar el correo de la solicitud.",
        },
        { status: 502 },
      );
    }

    const resultado = await respuesta.json();

    return NextResponse.json({
      ok: true,
      id: resultado?.id ?? null,
    });
  } catch (error) {
    console.error(
      "Error en /api/solicitudes-cotizacion:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Ocurrió un error interno al enviar la solicitud.",
      },
      { status: 500 },
    );
  }
}