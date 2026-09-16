import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { auth } from "@/auth";
import { puedeAbrirExpedienteTecnico } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";
import { eliminarProyectoV1, subirProyectosV1 } from "./actions";

type DocumentoProyecto = {
  id: string;
  tipo: string;
  nombreOriginal: string;
  bucket: string;
  ruta: string;
  bytes: number;
  estadoAnalisis: string;
  numeroPaginas: number | null;
  creadoEn: Date;
  observaciones: string | null;
};

type ControlProyecto = { proyectoConfirmado: boolean } | null;

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function urlTemporal(bucket: string, ruta: string) {
  const sb = supabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(ruta, 60 * 15);
  return error ? null : data.signedUrl;
}

const TIPOS = [
  ["ARQUITECTONICO", "Arquitectónico"],
  ["FACHADAS", "Fachadas"],
  ["HIDRAULICA", "Hidráulica"],
  ["SANITARIA", "Sanitaria"],
  ["GAS", "Gas"],
  ["ELECTRICA", "Eléctrica"],
  ["PUERTAS_VENTANAS", "Puertas y ventanas"],
  ["ACABADOS", "Acabados"],
  ["AIRE_ACONDICIONADO", "Aire acondicionado"],
  ["VOZ_DATOS", "Voz y datos"],
  ["OTROS", "Otros"],
] as const;

function etiquetaTipo(tipo: string) {
  return TIPOS.find(([codigo]) => codigo === tipo)?.[1] ?? tipo.replaceAll("_", " ");
}

function formatoBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default async function ProyectoV1Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      rol: true,
      activo: true,
      zonaId: true,
      gerenteId: true,
      coordinadorId: true,
      inspector: { select: { id: true, activo: true } },
    },
  });
  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: {
      id: true,
      folio: true,
      numeroInspeccion: true,
      estado: true,
      zonaId: true,
      inspectorId: true,
      clienteId: true,
      inspector: {
        select: {
          usuarioId: true,
          usuario: { select: { zonaId: true, gerenteId: true, coordinadorId: true } },
        },
      },
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true } },
    },
  });
  if (!inspeccion) notFound();
  if (inspeccion.numeroInspeccion !== 1) redirect(`/panel/inspecciones/${id}`);

  const acceso = puedeAbrirExpedienteTecnico(
    {
      id: usuario.id,
      rol: usuario.rol,
      zonaId: usuario.zonaId,
      gerenteId: usuario.gerenteId,
      coordinadorId: usuario.coordinadorId,
      inspectorId: usuario.inspector?.id ?? null,
    },
    {
      id: inspeccion.id,
      zonaId: inspeccion.zonaId,
      clienteId: inspeccion.clienteId,
      inspectorId: inspeccion.inspectorId,
      inspectorUsuarioId: inspeccion.inspector?.usuarioId ?? null,
      inspectorZonaId: inspeccion.inspector?.usuario.zonaId ?? null,
      coordinadorUsuarioId: inspeccion.inspector?.usuario.coordinadorId ?? null,
      gerenteUsuarioId: inspeccion.inspector?.usuario.gerenteId ?? null,
    },
  );
  if (!acceso) redirect("/acceso");

  const [controlRows, documentos] = await Promise.all([
    prisma.$queryRaw<ControlProyecto[]>`
      SELECT "proyectoConfirmado"
      FROM "InspeccionControlV2"
      WHERE "inspeccionId"=${id}
      LIMIT 1
    `,
    prisma.$queryRaw<DocumentoProyecto[]>`
      SELECT "id","tipo","nombreOriginal","bucket","ruta","bytes","estadoAnalisis","numeroPaginas","creadoEn","observaciones"
      FROM "DocumentoProyectoInspeccion"
      WHERE "inspeccionId"=${id}
      ORDER BY "creadoEn" ASC
    `,
  ]);

  const control = controlRows[0] ?? null;
  const esInspector = usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.id === inspeccion.inspectorId;
  const editable = esInspector && inspeccion.estado === EstadoInspeccion.EN_PROCESO && !control?.proyectoConfirmado;

  const documentosConUrl = await Promise.all(
    documentos.map(async (documento) => ({
      ...documento,
      url: await urlTemporal(documento.bucket, documento.ruta),
    })),
  );

  const totalPaginas = documentos.reduce((suma, documento) => suma + Number(documento.numeroPaginas ?? 0), 0);
  const pendientes = documentos.filter((documento) => documento.estadoAnalisis === "PENDIENTE").length;
  const procesados = documentos.filter((documento) => documento.estadoAnalisis === "COMPLETADO").length;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}/areas`} className="text-sm font-black text-cyan-300">← Áreas V1</Link>
          <Link href={`/panel/inspecciones/${id}/flujo`} className="rounded-full border border-white/15 px-4 py-2 text-sm font-black text-slate-300">Flujo de campo</Link>
        </div>

        <p className="mt-7 text-xs font-black uppercase tracking-[.24em] text-cyan-300">Proyecto V1</p>
        <h1 className="mt-2 text-4xl font-black">Documentos de proyecto</h1>
        <p className="mt-2 text-slate-400">{inspeccion.folio} · {inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? "Inmueble"}</p>

        {(query.ok || query.error) && (
          <div className={`mt-5 rounded-2xl p-4 font-bold ${query.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>
            {query.error ?? query.ok}
          </div>
        )}

        <section className="mt-7 grid gap-4 sm:grid-cols-4">
          <Resumen titulo="PDF cargados" valor={String(documentos.length)} />
          <Resumen titulo="Páginas" valor={String(totalPaginas)} />
          <Resumen titulo="Pendientes de análisis" valor={String(pendientes)} />
          <Resumen titulo="Analizados" valor={String(procesados)} />
        </section>

        {control?.proyectoConfirmado && (
          <div className="mt-6 rounded-3xl border border-emerald-300/20 bg-emerald-300/5 p-5 text-emerald-200">
            <p className="font-black">Proyecto confirmado</p>
            <p className="mt-2 text-sm">Los documentos quedaron bloqueados para conservar la trazabilidad del expediente V1.</p>
          </div>
        )}

        {editable && (
          <section className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-6">
            <h2 className="text-xl font-black">Cargar uno o varios PDF</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Selecciona el tipo de proyecto y carga varios archivos en el mismo lote. El lote completo debe ser menor a 11 MB y cada archivo menor a 10 MB.</p>
            <form action={subirProyectosV1} className="mt-5 grid gap-4 lg:grid-cols-[260px_1fr_auto] lg:items-end">
              <input type="hidden" name="inspeccionId" value={id} />
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">Tipo de proyecto</span>
                <select name="tipo" required className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3">
                  {TIPOS.map(([codigo, etiqueta]) => <option key={codigo} value={codigo}>{etiqueta}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">Archivos PDF</span>
                <input name="archivos" type="file" accept="application/pdf,.pdf" multiple required className="block w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-300" />
              </label>
              <button className="rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950">Cargar PDF</button>
            </form>
          </section>
        )}

        <section className="mt-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Expediente de proyecto</h2>
              <p className="mt-1 text-sm text-slate-400">Cada documento conserva tipo, páginas, tamaño y estado de análisis.</p>
            </div>
            {documentos.length > 0 && !control?.proyectoConfirmado && (
              <p className="text-xs font-bold text-amber-300">Confirma el proyecto desde Áreas V1 cuando la documentación esté completa.</p>
            )}
          </div>

          {documentosConUrl.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-white/15 bg-slate-900 p-8 text-center text-slate-400">Aún no hay PDF de proyecto cargados.</div>
          ) : (
            <div className="mt-4 space-y-3">
              {documentosConUrl.map((documento) => (
                <article key={documento.id} className="rounded-3xl border border-white/10 bg-slate-900 p-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                        <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-cyan-300">{etiquetaTipo(documento.tipo)}</span>
                        <span className={`rounded-full px-2 py-1 ${documento.estadoAnalisis === "COMPLETADO" ? "bg-emerald-300/10 text-emerald-300" : documento.estadoAnalisis === "ERROR" ? "bg-rose-300/10 text-rose-300" : "bg-amber-300/10 text-amber-300"}`}>{documento.estadoAnalisis.replaceAll("_", " ")}</span>
                      </div>
                      <p className="mt-2 break-all font-black">{documento.nombreOriginal}</p>
                      {documento.observaciones && <p className="mt-2 text-sm text-slate-400">{documento.observaciones}</p>}
                    </div>
                    <div className="text-sm text-slate-300"><strong>{documento.numeroPaginas ?? "—"}</strong> página(s)</div>
                    <div className="text-sm text-slate-300">{formatoBytes(documento.bytes)}</div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {documento.url && <a href={documento.url} target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-black text-cyan-200">Abrir PDF</a>}
                      {editable && (
                        <form action={eliminarProyectoV1}>
                          <input type="hidden" name="inspeccionId" value={id} />
                          <input type="hidden" name="documentoId" value={documento.id} />
                          <button className="rounded-lg border border-rose-300/30 px-3 py-2 text-xs font-black text-rose-200">Eliminar</button>
                        </form>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-7 rounded-3xl border border-violet-300/20 bg-violet-300/5 p-6">
          <p className="text-xs font-black uppercase tracking-[.2em] text-violet-300">Siguiente etapa del módulo</p>
          <h2 className="mt-2 text-xl font-black">Análisis automático del proyecto</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">La estructura ya deja cada PDF listo para análisis. El motor de IA deberá extraer áreas, dimensiones, especificaciones, ubicaciones y elementos, y convertirlos en datos estructurados que complementen la Biblioteca Certeza. Hasta que ese motor esté conectado, los documentos permanecerán en estado PENDIENTE.</p>
        </section>
      </div>
    </main>
  );
}

function Resumen({ titulo, valor }: { titulo: string; valor: string }) {
  return <article className="rounded-2xl border border-white/10 bg-slate-900 p-5"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{titulo}</p><p className="mt-2 text-2xl font-black text-cyan-300">{valor}</p></article>;
}
