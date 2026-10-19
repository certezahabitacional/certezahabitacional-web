import { headers } from "next/headers";

type ArchivoTemporalIA = {
  nombre: string;
  base64: string;
  bytes: number;
};

const MARCA_INSTALADA = Symbol.for("certeza.aiGatewayOpenAICompat.instalada");
const ARCHIVOS_TEMPORALES = Symbol.for("certeza.aiGatewayOpenAICompat.archivos");
const CLAVE_COMPAT = "__CERTEZA_VERCEL_AI_GATEWAY_OIDC__";

type GlobalCompat = typeof globalThis & {
  [MARCA_INSTALADA]?: boolean;
  [ARCHIVOS_TEMPORALES]?: Map<string, ArchivoTemporalIA>;
};

function respuestaJson(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizarModeloGateway(modelo: unknown) {
  const valor = String(modelo || "gpt-5.6-sol").trim();
  return valor.includes("/") ? valor : `openai/${valor}`;
}

async function obtenerTokenGatewayRuntime() {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  if (process.env.VERCEL_OIDC_TOKEN) return process.env.VERCEL_OIDC_TOKEN;

  try {
    const requestHeaders = await headers();
    return requestHeaders.get("x-vercel-oidc-token");
  } catch {
    return null;
  }
}

function sustituirArchivosEnInput(input: unknown, archivos: Map<string, ArchivoTemporalIA>) {
  if (!Array.isArray(input)) return input;

  return input.map((item) => {
    if (!item || typeof item !== "object") return item;
    const mensaje = item as Record<string, unknown>;
    const contenido = Array.isArray(mensaje.content) ? mensaje.content : mensaje.content;

    if (!Array.isArray(contenido)) {
      return mensaje.type ? mensaje : { ...mensaje, type: "message" };
    }

    return {
      ...mensaje,
      type: mensaje.type || "message",
      content: contenido.map((parte) => {
        if (!parte || typeof parte !== "object") return parte;
        const bloque = parte as Record<string, unknown>;
        if (bloque.type !== "input_file" || typeof bloque.file_id !== "string") return bloque;

        const archivo = archivos.get(bloque.file_id);
        if (!archivo) return bloque;

        return {
          type: "input_file",
          file_data: `data:application/pdf;base64,${archivo.base64}`,
          filename: archivo.nombre,
        };
      }),
    };
  });
}

export function instalarCompatibilidadOpenAIGateway() {
  const globalCompat = globalThis as GlobalCompat;
  if (globalCompat[MARCA_INSTALADA]) return;

  // Si existe una clave OpenAI real, se respeta íntegramente el flujo directo actual.
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== CLAVE_COMPAT) return;

  globalCompat[MARCA_INSTALADA] = true;
  globalCompat[ARCHIVOS_TEMPORALES] ??= new Map<string, ArchivoTemporalIA>();
  const archivos = globalCompat[ARCHIVOS_TEMPORALES]!;
  const fetchOriginal = globalThis.fetch.bind(globalThis);

  // El flujo legado valida la existencia de OPENAI_API_KEY antes de hacer fetch.
  // Esta marca nunca sale al navegador ni se usa como credencial real; el token
  // OIDC se obtiene del contexto de la petición justo al invocar AI Gateway.
  process.env.OPENAI_API_KEY = CLAVE_COMPAT;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlTexto = typeof input === "string" || input instanceof URL
      ? String(input)
      : input.url;

    let url: URL;
    try {
      url = new URL(urlTexto);
    } catch {
      return fetchOriginal(input, init);
    }

    if (url.hostname !== "api.openai.com") {
      return fetchOriginal(input, init);
    }

    const metodo = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (url.pathname === "/v1/files" && metodo === "POST") {
      const form = init?.body;
      if (!(form instanceof FormData)) {
        return respuestaJson({ error: { message: "No fue posible preparar el PDF para análisis." } }, 400);
      }

      const valor = form.get("file");
      if (!(valor instanceof Blob)) {
        return respuestaJson({ error: { message: "El archivo PDF no llegó correctamente al motor de análisis." } }, 400);
      }

      const nombre = valor instanceof File && valor.name ? valor.name : "proyecto.pdf";
      const bytes = Buffer.from(await valor.arrayBuffer());
      const id = `gateway-file-${crypto.randomUUID()}`;
      archivos.set(id, {
        nombre,
        base64: bytes.toString("base64"),
        bytes: bytes.length,
      });

      return respuestaJson({
        id,
        object: "file",
        bytes: bytes.length,
        filename: nombre,
        purpose: "user_data",
        status: "processed",
      });
    }

    if (url.pathname === "/v1/responses" && metodo === "POST") {
      let cuerpo: Record<string, unknown>;
      try {
        cuerpo = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      } catch {
        return respuestaJson({ error: { message: "No fue posible preparar la solicitud de análisis." } }, 400);
      }

      const tokenGateway = await obtenerTokenGatewayRuntime();
      if (!tokenGateway) {
        return respuestaJson({
          error: {
            message: "El análisis automático no pudo obtener la credencial OIDC de Vercel para AI Gateway.",
          },
        }, 500);
      }

      const solicitud = {
        ...cuerpo,
        model: normalizarModeloGateway(cuerpo.model),
        input: sustituirArchivosEnInput(cuerpo.input, archivos),
      };

      return fetchOriginal("https://ai-gateway.vercel.sh/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenGateway}`,
        },
        body: JSON.stringify(solicitud),
        cache: "no-store",
      });
    }

    if (url.pathname.startsWith("/v1/files/") && metodo === "DELETE") {
      const id = decodeURIComponent(url.pathname.slice("/v1/files/".length));
      const eliminado = archivos.delete(id);
      return respuestaJson({ id, object: "file", deleted: eliminado });
    }

    // Ninguna otra llamada a OpenAI se reescribe silenciosamente.
    return fetchOriginal(input, init);
  }) as typeof fetch;
}
