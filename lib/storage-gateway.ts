import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

const BUCKET_DEFAULT = process.env.SUPABASE_STORAGE_BUCKET || "evidencias";

type Operacion = "UPLOAD" | "REMOVE" | "SIGN";

type Contexto = {
  usuarioId: string;
  inspeccionId: string;
  bucket?: string;
  ruta: string;
};

function baseUrl() {
  const explicita = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (explicita) return explicita.replace(/\/$/, "");

  const urlsDb = `${process.env.DIRECT_URL ?? ""} ${process.env.DATABASE_URL ?? ""}`;
  const coincidencia = urlsDb.match(/(?:db\.|postgres\.)?([a-z0-9]{20})\.supabase\.co/i)
    ?? urlsDb.match(/([a-z0-9]{20})/i);
  if (!coincidencia?.[1]) {
    throw new Error("No fue posible determinar el proyecto de almacenamiento desde la configuración del servidor.");
  }
  return `https://${coincidencia[1]}.supabase.co`;
}

async function emitirToken(operacion: Operacion, contexto: Contexto) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const bucket = contexto.bucket || BUCKET_DEFAULT;

  await prisma.$executeRaw`
    INSERT INTO "StorageOperacionToken"
      ("tokenHash","usuarioId","inspeccionId","operacion","bucket","ruta","expiraEn")
    VALUES
      (${tokenHash},${contexto.usuarioId},${contexto.inspeccionId},${operacion},${bucket},${contexto.ruta},NOW() + INTERVAL '5 minutes')
  `;

  await prisma.$executeRaw`
    DELETE FROM "StorageOperacionToken"
    WHERE "expiraEn" < NOW() - INTERVAL '1 day'
  `.catch(() => undefined);

  return { token, bucket };
}

async function invocarStorage(token: string, body: FormData | Record<string, unknown>) {
  const esForm = body instanceof FormData;
  const respuesta = await fetch(`${baseUrl()}/functions/v1/storage-gateway`, {
    method: "POST",
    headers: {
      "x-storage-token": token,
      ...(esForm ? {} : { "Content-Type": "application/json" }),
    },
    body: esForm ? body : JSON.stringify(body),
    cache: "no-store",
  });

  const resultado = await respuesta.json().catch(() => ({})) as {
    ok?: boolean;
    error?: string;
    signedUrl?: string;
  };
  if (!respuesta.ok || !resultado.ok) {
    throw new Error(resultado.error || `Storage respondió ${respuesta.status}.`);
  }
  return resultado;
}

export async function subirArchivoStorage(contexto: Contexto & { archivo: File }) {
  const { token, bucket } = await emitirToken("UPLOAD", contexto);
  const form = new FormData();
  form.set("op", "UPLOAD");
  form.set("bucket", bucket);
  form.set("path", contexto.ruta);
  form.set("file", contexto.archivo, contexto.archivo.name || "archivo");
  await invocarStorage(token, form);
}

export async function eliminarArchivoStorage(contexto: Contexto) {
  const { token, bucket } = await emitirToken("REMOVE", contexto);
  await invocarStorage(token, { op: "REMOVE", bucket, path: contexto.ruta });
}

export async function urlFirmadaStorage(contexto: Contexto, segundos = 900) {
  const { token, bucket } = await emitirToken("SIGN", contexto);
  const resultado = await invocarStorage(token, {
    op: "SIGN",
    bucket,
    path: contexto.ruta,
    expiresIn: segundos,
  });
  return resultado.signedUrl || null;
}
