import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { puedeAbrirExpedienteTecnico } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";
import { validarResultadoDocumentoProyectoV1 } from "@/lib/proyecto-v1-analisis";
import {
  CONCEPTOS_PROYECTO_V1,
  correlacionarAreasProyectoV1,
  normalizarProyectoV1,
} from "@/lib/proyecto-v1-matriz";
import { obtenerSupabaseAdminOpcional } from "@/lib/supabase-admin";
import { iniciarPuntosCriticosV1 } from "../puntos-criticos/actions";
import {
  analizarProyectoV1,
  confirmarMatrizProyectoV1,
  eliminarProyectoV1,
  generarGuiaDesdeProyectoV1,
  subirProyectosV1,
} from "./workflow-actions";

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
  datosExtraidos: unknown;
};

type ControlProyecto = {
  proyectoConfirmado: boolean;
  resumenEstadistico: unknown;
} | null;

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

async function urlTemporal(bucket: string, ruta: string) {
  const sb = obtenerSupabaseAdminOpcional();
  if (!sb) return null;
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(ruta, 60 * 15);
  return error ? null : data.signedUrl;
}

function resumenProyectoGuardado(valor: unknown) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const raiz = valor as Record<string, unknown>;
  const proyecto = raiz.proyectoDigitalV1;
  if (!proyecto || typeof proyecto !== "object" || Array.isArray(proyecto)) return null;
  return proyecto as {
    modalidad?: string;
    matriz?: Array<{ codigo: string; etiqueta: string; aplica: boolean; proyecto: boolean; plantilla: boolean }>;
    areasCorrelacionadas?: Array<{ clave: string; nombre: string; enProyecto: boolean; enPlantilla: boolean }>;
  };
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
      cotizacionId: true,
      requiereGerenteZona: true,
      requiereCoordinador: true,
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
  if (inspeccion.numeroInspeccion !== 1) redirect(`/panel/inspecciones/${id}/captura`);

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
      requiereGerenteZona: inspeccion.requiereGerenteZona,
      requiereCoordinador: inspeccion.requiereCoordinador,
    },
  );
  if (!acceso) redirect("/acceso");

  const [controlRows, documentos, guiaRows, bibliotecaGrupos, versionCotizacion] = await Promise.all([
    prisma.$queryRaw<ControlProyecto[]>`
      SELECT "proyectoConfirmado","resumenEstadistico"
      FROM "InspeccionControlV2" WHERE "inspeccionId"=${id} LIMIT 1
    `,
    prisma.$queryRaw<DocumentoProyecto[]>`
      SELECT "id","tipo","nombreOriginal","bucket","ruta","bytes","estadoAnalisis","numeroPaginas","creadoEn","observaciones","datosExtraidos"
      FROM "DocumentoProyectoInspeccion" WHERE "inspeccionId"=${id} ORDER BY "creadoEn" ASC
    `,
    prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS "total" FROM "GuiaInspeccionItem"
      WHERE "inspeccionId"=${id} AND "origen"='PROYECTO'
    `,
    prisma.$queryRaw<Array<{ grupo: string }>>`
      SELECT DISTINCT "grupo" FROM "BibliotecaPuntoCerteza" WHERE "activa"=true
    `,
    inspeccion.cotizacionId
      ? prisma.cotizacionVersion.findFirst({
          where: { cotizacionId: inspeccion.cotizacionId },
          orderBy: { version: "desc" },
          select: { datos: true },
        })
      : Promise.resolve(null),
  ]);

  const control = controlRows[0] ?? null;

  // El proyecto es una etapa de preparación de una sola vez.
  // Si ya fue confirmado, un enlace guardado o antiguo debe volver al recorrido vigente.
  if (control?.proyectoConfirmado) {
    redirect(`/panel/inspecciones/${id}/flujo`);
  }

  const guardado = resumenProyectoGuardado(control?.resumenEstadistico);
  const esInspector = usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.id === inspeccion.inspectorId && Boolean(usuario.inspector?.activo);
  const esDirector = usuario.rol === RolUsuario.DIRECTOR;
  const responsable = esInspector || esDirector;
  const editable = responsable && inspeccion.estado === EstadoInspeccion.EN_PROCESO && !control?.proyectoConfirmado;

  const documentosConUrl = await Promise.all(
    documentos.map(async (documento) => ({ ...documento, url: await urlTemporal(documento.bucket, documento.ruta) })),
  );
  const resultados = documentos.flatMap((documento) => {
    if (!documento.datosExtraidos) return [];
    try { return [validarResultadoDocumentoProyectoV1(documento.datosExtraidos)]; } catch { return []; }
  });
  const snapshot = versionCotizacion?.datos && typeof versionCotizacion.datos === "object" && !Array.isArray(versionCotizacion.datos)
    ? versionCotizacion.datos as Record<string, unknown>
    : {};
  const areasCorrelacionadas = correlacionarAreasProyectoV1(snapshot, resultados.flatMap((resultado) => resultado.areas));
  const gruposDisponibles = new Set(bibliotecaGrupos.map((fila) => normalizarProyectoV1(fila.grupo)));
  const tiposCargados = new Set(documentos.map((documento) => normalizarProyectoV1(documento.tipo)));
  const matrizVista = CONCEPTOS_PROYECTO_V1.map((concepto) => ({
    ...concepto,
    proyecto: concepto.tiposProyecto.some((tipo) => tiposCargados.has(tipo)),
    plantilla: concepto.gruposPlantilla.some((grupo) => gruposDisponibles.has(normalizarProyectoV1(grupo))),
  }));

  const totalPaginas = documentos.reduce((suma, documento) => suma + Number(documento.numeroPaginas ?? 0), 0);
  const pendientes = documentos.filter((documento) => documento.estadoAnalisis !== "COMPLETADO").length;
  const procesados = documentos.filter((documento) => documento.estadoAnalisis === "COMPLETADO").length;
  const todosAnalizados = documentos.length > 0 && procesados === documentos.length;
  const puntosProyecto = Number(guiaRows[0]?.total ?? 0);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}`} className="text-sm font-black text-cyan-300">← Expediente</Link>
          <span className="rounded-full border border-white/10 px-4 py-2 text-xs font-black text-slate-300">{inspeccion.folio}</span>
        </div>

        <section className="mt-7">
          <p className="text-xs font-black uppercase tracking-[.24em] text-cyan-300">Paso 1 después de iniciar</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Carga de proyecto digital en PDF</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">Carga los planos disponibles, analiza únicamente la información explícita, correlaciona las áreas del proyecto con lo declarado por el cliente y define el alcance técnico antes de iniciar el recorrido.</p>
          <p className="mt-2 text-sm text-slate-500">{inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? "Inmueble"}</p>
        </section>

        {(query.ok || query.error) && (
          <div className={`mt-5 rounded-2xl p-4 text-sm font-bold ${query.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>
            {query.error ?? query.ok}
          </div>
        )}

        <section className="mt-6 grid gap-3 sm:grid-cols-5">
          <Resumen titulo="PDF" valor={String(documentos.length)} />
          <Resumen titulo="Páginas" valor={String(totalPaginas)} />
          <Resumen titulo="Analizados" valor={`${procesados}/${documentos.length}`} />
          <Resumen titulo="Áreas correlacionadas" valor={String(areasCorrelacionadas.length)} />
          <Resumen titulo="Puntos de proyecto" valor={String(puntosProyecto)} />
        </section>

        {control?.proyectoConfirmado && (
          <section className="mt-6 rounded-3xl border border-emerald-300/25 bg-emerald-300/5 p-6">
            <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Alcance confirmado</p>
            <h2 className="mt-2 text-2xl font-black">Proyecto/Plantilla bloqueado para trazabilidad</h2>
            <p className="mt-2 text-sm text-slate-300">Modalidad: <strong>{guardado?.modalidad === "SIN_PDF" ? "Sin proyecto PDF" : "Con proyecto PDF"}</strong>. La siguiente etapa obligatoria es la inspección secuencial de puntos críticos.</p>
            {guardado?.matriz && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {guardado.matriz.map((item) => (
                  <div key={item.codigo} className="rounded-xl border border-white/10 bg-slate-950 p-3 text-xs">
                    <p className="font-black">{item.etiqueta}</p>
                    <p className={item.aplica ? "mt-1 font-bold text-emerald-300" : "mt-1 font-bold text-slate-500"}>{item.aplica ? "SI APLICA" : "NO APLICA"}</p>
                  </div>
                ))}
              </div>
            )}
            <form action={iniciarPuntosCriticosV1} className="mt-5">
              <input type="hidden" name="inspeccionId" value={id} />
              <button className="rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950">INICIO DE INSPECCIÓN DE PUNTOS CRÍTICOS</button>
            </form>
          </section>
        )}

        {!control?.proyectoConfirmado && (
          <>
            {editable && (
              <section className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-5 sm:p-6">
                <h2 className="text-xl font-black">1. Cargar planos o documentos técnicos</h2>
                <p className="mt-2 text-sm text-slate-300">Puedes cargar varios PDF por especialidad. Cada archivo debe ser menor a 10 MB y cada lote menor a 11 MB.</p>
                <form action={subirProyectosV1} className="mt-5 grid gap-4 lg:grid-cols-[260px_1fr_auto] lg:items-end">
                  <input type="hidden" name="inspeccionId" value={id} />
                  <label>
                    <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">Tipo de proyecto</span>
                    <select name="tipo" required className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3">
                      {TIPOS.map(([codigo, etiqueta]) => <option key={codigo} value={codigo}>{etiqueta}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">PDF</span>
                    <input name="archivos" type="file" accept="application/pdf,.pdf" multiple required className="block w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-300" />
                  </label>
                  <button className="rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950">CARGAR PDF</button>
                </form>
              </section>
            )}

            <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900 p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">2. Analizar documentos</h2>
                  <p className="mt-1 text-sm text-slate-400">La IA extrae áreas, dimensiones, especificaciones y elementos verificables. No inventa información faltante.</p>
                </div>
                {pendientes > 0 && <span className="text-xs font-black text-amber-300">{pendientes} pendiente(s)</span>}
              </div>

              {documentosConUrl.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-500">No hay PDF cargados. Si el cliente no cuenta con proyecto, podrás declarar SIN PROYECTO PDF en la matriz inferior.</div>
              ) : (
                <div className="mt-4 space-y-3">
                  {documentosConUrl.map((documento) => (
                    <article key={documento.id} className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                      <div className="grid gap-3 lg:grid-cols-[1fr_120px_110px_auto] lg:items-center">
                        <div>
                          <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                            <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-cyan-300">{etiquetaTipo(documento.tipo)}</span>
                            <span className={`rounded-full px-2 py-1 ${documento.estadoAnalisis === "COMPLETADO" ? "bg-emerald-300/10 text-emerald-300" : documento.estadoAnalisis === "ERROR" ? "bg-rose-300/10 text-rose-300" : "bg-amber-300/10 text-amber-300"}`}>{documento.estadoAnalisis}</span>
                          </div>
                          <p className="mt-2 break-all font-black">{documento.nombreOriginal}</p>
                          {documento.observaciones && <p className="mt-1 text-xs text-slate-500">{documento.observaciones}</p>}
                        </div>
                        <p className="text-sm text-slate-300">{documento.numeroPaginas ?? "—"} pág.</p>
                        <p className="text-sm text-slate-300">{formatoBytes(documento.bytes)}</p>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          {documento.url && <a href={documento.url} target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-black text-cyan-200">ABRIR</a>}
                          {editable && documento.estadoAnalisis !== "ANALIZANDO" && (
                            <form action={analizarProyectoV1}><input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="documentoId" value={documento.id}/><button className="rounded-lg border border-violet-300/30 px-3 py-2 text-xs font-black text-violet-200">{documento.estadoAnalisis === "COMPLETADO" ? "REANALIZAR" : "ANALIZAR IA"}</button></form>
                          )}
                          {editable && (
                            <form action={eliminarProyectoV1}><input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="documentoId" value={documento.id}/><button className="rounded-lg border border-rose-300/30 px-3 py-2 text-xs font-black text-rose-200">ELIMINAR</button></form>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {documentos.length > 0 && (
              <section className="mt-6 rounded-3xl border border-violet-300/20 bg-violet-300/5 p-5 sm:p-6">
                <h2 className="text-xl font-black">3. Convertir el proyecto en puntos verificables</h2>
                <p className="mt-2 text-sm text-slate-300">Cuando todos los PDF estén analizados, genera la guía del proyecto. Esta guía se sumará a los puntos mínimos de la Plantilla Certeza.</p>
                {editable && <form action={generarGuiaDesdeProyectoV1} className="mt-4"><input type="hidden" name="inspeccionId" value={id}/><button disabled={!todosAnalizados} className="rounded-xl bg-violet-300 px-5 py-3 font-black text-slate-950 disabled:opacity-30">GENERAR / ACTUALIZAR GUÍA</button></form>}
                {puntosProyecto > 0 && <p className="mt-3 text-sm font-bold text-emerald-300">{puntosProyecto} punto(s) de proyecto listos.</p>}
              </section>
            )}

            <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900 p-5 sm:p-6">
              <h2 className="text-xl font-black">4. Correlación automática de áreas</h2>
              <p className="mt-2 text-sm text-slate-400">El sistema compara las áreas declaradas por el cliente con las detectadas en los PDF. Las coincidencias se fusionan; las diferencias se conservan para revisión.</p>
              {areasCorrelacionadas.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-500">Aún no hay áreas correlacionables. Puedes continuar SIN PROYECTO PDF; las áreas declaradas se podrán completar en el siguiente paso.</p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-3">Área correlacionada</th><th className="p-3 text-center">Proyecto</th><th className="p-3 text-center">Plantilla / cliente</th><th className="p-3">Referencia</th></tr></thead>
                    <tbody>
                      {areasCorrelacionadas.map((area) => (
                        <tr key={area.clave} className="border-t border-white/10"><td className="p-3 font-black">{area.nombre}</td><td className="p-3 text-center font-black">{area.enProyecto ? <span className="text-emerald-300">SÍ</span> : <span className="text-slate-600">NO</span>}</td><td className="p-3 text-center font-black">{area.enPlantilla ? <span className="text-emerald-300">SÍ</span> : <span className="text-slate-600">NO</span>}</td><td className="p-3 text-xs text-slate-400">{[area.nivel, area.ubicacion].filter(Boolean).join(" · ") || "—"}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <form action={confirmarMatrizProyectoV1} className="mt-6 rounded-3xl border border-amber-300/25 bg-amber-300/5 p-5 sm:p-6">
              <input type="hidden" name="inspeccionId" value={id}/>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.2em] text-amber-300">5. Proyecto / Plantilla</p>
                  <h2 className="mt-2 text-2xl font-black">Definir alcance técnico</h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-300">Revisa los siete conceptos prioritarios. Proyecto indica si existe un PDF de esa especialidad; Plantilla indica si la Biblioteca Certeza contempla puntos de revisión relacionados. Tú defines si el concepto aplica físicamente a esta vivienda.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="rounded-2xl border border-cyan-300/25 bg-cyan-300/5 p-4"><input type="radio" name="modalidad" value="CON_PDF" required defaultChecked={documentos.length > 0} className="mr-2"/><strong>CON PROYECTO PDF</strong><p className="mt-1 text-xs text-slate-400">Requiere PDF analizados y guía generada.</p></label>
                <label className="rounded-2xl border border-white/10 bg-slate-950 p-4"><input type="radio" name="modalidad" value="SIN_PDF" required defaultChecked={documentos.length === 0} className="mr-2"/><strong>SIN PROYECTO PDF</strong><p className="mt-1 text-xs text-slate-400">Sólo disponible cuando no existen PDF cargados.</p></label>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="p-3">Concepto técnico</th><th className="p-3 text-center">Proyecto</th><th className="p-3 text-center">Plantilla</th><th className="p-3 text-center">Alcance</th></tr></thead>
                  <tbody>
                    {matrizVista.map((concepto) => (
                      <tr key={concepto.codigo} className="border-t border-white/10">
                        <td className="p-3"><p className="font-black">{concepto.etiqueta}</p><p className="mt-1 text-xs text-slate-500">{concepto.descripcion}</p></td>
                        <td className="p-3 text-center font-black">{concepto.proyecto ? <span className="text-cyan-300">SÍ</span> : <span className="text-slate-600">NO</span>}</td>
                        <td className="p-3 text-center font-black">{concepto.plantilla ? <span className="text-violet-300">SÍ</span> : <span className="text-slate-600">NO</span>}</td>
                        <td className="p-3"><div className="flex justify-center gap-4"><label className="font-black text-emerald-300"><input type="radio" name={`aplica_${concepto.codigo}`} value="SI" required defaultChecked={concepto.proyecto || concepto.plantilla} className="mr-1"/>SI APLICA</label><label className="font-black text-slate-400"><input type="radio" name={`aplica_${concepto.codigo}`} value="NO" required defaultChecked={!concepto.proyecto && !concepto.plantilla} className="mr-1"/>NO APLICA</label></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {editable ? (
                <button className="mt-5 w-full rounded-xl bg-amber-300 px-6 py-4 text-lg font-black text-slate-950">CONFIRMAR PROYECTO / PLANTILLA Y CONTINUAR</button>
              ) : (
                <p className="mt-5 rounded-xl border border-white/10 p-4 text-center text-sm font-bold text-slate-500">Vista de consulta. La confirmación corresponde al Inspector asignado o al Director.</p>
              )}
            </form>
          </>
        )}

        <section className="mt-6 rounded-3xl border border-amber-300/15 bg-slate-900 p-5 text-sm text-slate-400">
          <strong className="text-amber-200">Criterio de control:</strong> el análisis automático apoya la lectura del proyecto, pero no sustituye la revisión física ni el criterio técnico del responsable. Una ausencia en el PDF no significa por sí misma que un elemento no exista en la vivienda.
        </section>
      </div>
    </main>
  );
}

function Resumen({ titulo, valor }: { titulo: string; valor: string }) {
  return <article className="rounded-2xl border border-white/10 bg-slate-900 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{titulo}</p><p className="mt-2 text-2xl font-black text-cyan-300">{valor}</p></article>;
}
