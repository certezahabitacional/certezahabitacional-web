import { createClient } from "@supabase/supabase-js";

import { auth } from "@/auth";
import {
  eliminarArchivoStorage,
  subirArchivoStorage,
  urlFirmadaStorage,
} from "@/lib/storage-gateway";

function claveSecretaSupabase() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.SUPABASE_SECRET_KEY) return process.env.SUPABASE_SECRET_KEY;

  const grupo = process.env.SUPABASE_SECRET_KEYS;
  if (grupo) {
    try {
      const claves = JSON.parse(grupo) as Record<string, string>;
      if (claves.default) return claves.default;
    } catch {
      // No se exponen valores secretos en mensajes ni logs.
    }
  }

  return null;
}

async function contextoStorage(ruta: string) {
  const inspeccionId = ruta.split("/").filter(Boolean)[0];
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("La sesión expiró antes de completar la operación de almacenamiento.");
  }
  if (!inspeccionId) {
    throw new Error("No fue posible identificar la inspección asociada al archivo.");
  }

  return { usuarioId: session.user.id, inspeccionId };
}

function archivoDesdeDato(
  dato: unknown,
  ruta: string,
  contentType?: string,
) {
  const nombre = ruta.split("/").pop() || "archivo";

  if (dato instanceof File) return dato;
  if (dato instanceof Blob) {
    return new File([dato], nombre, {
      type: contentType || dato.type || "application/octet-stream",
    });
  }
  if (dato instanceof Uint8Array) {
    const copia = new Uint8Array(dato.byteLength);
    copia.set(dato);
    return new File([copia.buffer], nombre, {
      type: contentType || "application/octet-stream",
    });
  }
  if (dato instanceof ArrayBuffer) {
    return new File([dato], nombre, {
      type: contentType || "application/octet-stream",
    });
  }
  if (typeof dato === "string") {
    return new File([dato], nombre, {
      type: contentType || "text/plain",
    });
  }

  throw new Error("El formato del archivo no es compatible con el almacenamiento seguro.");
}

function clienteStoragePorGateway() {
  const cliente = {
    storage: {
      from(bucket: string) {
        return {
          async upload(
            ruta: string,
            dato: unknown,
            opciones?: { contentType?: string; upsert?: boolean },
          ) {
            try {
              if (opciones?.upsert) {
                throw new Error("El reemplazo directo de archivos no está habilitado en la pasarela segura.");
              }
              const contexto = await contextoStorage(ruta);
              const archivo = archivoDesdeDato(dato, ruta, opciones?.contentType);
              await subirArchivoStorage({
                ...contexto,
                bucket,
                ruta,
                archivo,
              });
              return { data: { path: ruta }, error: null };
            } catch (error) {
              return {
                data: null,
                error: error instanceof Error ? error : new Error("No fue posible guardar el archivo."),
              };
            }
          },

          async download(ruta: string) {
            try {
              const contexto = await contextoStorage(ruta);
              const signedUrl = await urlFirmadaStorage(
                { ...contexto, bucket, ruta },
                60 * 5,
              );
              if (!signedUrl) throw new Error("No fue posible generar acceso temporal al archivo.");

              const respuesta = await fetch(signedUrl, { cache: "no-store" });
              if (!respuesta.ok) {
                throw new Error(`No fue posible recuperar el archivo (${respuesta.status}).`);
              }
              return { data: await respuesta.blob(), error: null };
            } catch (error) {
              return {
                data: null,
                error: error instanceof Error ? error : new Error("No fue posible recuperar el archivo."),
              };
            }
          },

          async remove(rutas: string[]) {
            try {
              for (const ruta of rutas) {
                const contexto = await contextoStorage(ruta);
                await eliminarArchivoStorage({ ...contexto, bucket, ruta });
              }
              return {
                data: rutas.map((name) => ({ name })),
                error: null,
              };
            } catch (error) {
              return {
                data: null,
                error: error instanceof Error ? error : new Error("No fue posible eliminar el archivo."),
              };
            }
          },

          async createSignedUrl(ruta: string, segundos: number) {
            try {
              const contexto = await contextoStorage(ruta);
              const signedUrl = await urlFirmadaStorage(
                { ...contexto, bucket, ruta },
                segundos,
              );
              if (!signedUrl) throw new Error("No fue posible generar la vista temporal del archivo.");
              return { data: { signedUrl }, error: null };
            } catch (error) {
              return {
                data: null,
                error: error instanceof Error ? error : new Error("No fue posible generar la vista temporal."),
              };
            }
          },
        };
      },
    },
  };

  return cliente as unknown as ReturnType<typeof createClient>;
}

export function obtenerSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = claveSecretaSupabase();

  if (url && key) {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  // Producción puede operar Storage sin exponer una service_role en Vercel.
  // La pasarela emite permisos efímeros, ligados a usuario, inspección, ruta y operación.
  return clienteStoragePorGateway();
}

export function obtenerSupabaseAdminOpcional() {
  try {
    return obtenerSupabaseAdmin();
  } catch {
    return null;
  }
}
