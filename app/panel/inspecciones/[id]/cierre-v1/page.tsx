import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { bloquearContenidoTecnicoV1Finalizado } from "@/lib/acceso-v1-final";
import { prisma } from "@/lib/prisma";
import {
  concluirInspeccionTecnicaV1,
  confirmarRevisionFinalInspectorV1,
  enviarReporteDireccionV1,
  terminarTrabajoCampoV1,
} from "./actions";

type Estado = {
  inspeccionTecnicaConcluidaEn: Date | null;
  campoFinalizadoEn: Date | null;
  preReporteGeneradoEn: Date | null;
  revisionInspectorFinalEn: Date | null;
  reporteLimiteEn: Date | null;
  reabiertaEn: Date | null;
  areasTotal: number;
  areasCompletas: number;
  procesosTotal: number;
  procesosCompletos: number;
  hallazgos: number;
  hallazgosCompletos: number;
  fotosFachada: number;
  portadaFachada: number;
  syncPendientes: number;
};

export default async function CierreV1Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  await bloquearContenidoTecnicoV1Finalizado(id);

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true, inspector: { select: { id: true } } },
  });
  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: {
      id: true,
      folio: true,
      numeroInspeccion: true,
      estado: true,
      inspectorId: true,
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true, direccion: true } },
      firmas: { select: { tipo: true, firmadaEn: true } },
      revisiones: {
        where: { rol: RolUsuario.DIRECTOR },
        orderBy: { creadaEn: "desc" },
        take: 6,
        select: {
          id: true,
          decision: true,
          estado: true,
          comentario: true,
          creadaEn: true,
          usuario: { select: { nombre: true } },
        },
      },
    },
  });
  if (!inspeccion) notFound();
  if (inspeccion.numeroInspeccion !== 1) redirect(`/panel/inspecciones/${id}`);

  const esInspector = usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.id === inspeccion.inspectorId;
  const consulta = ([RolUsuario.DIRECTOR, RolUsuario.GERENTE, RolUsuario.COORDINADOR] as RolUsuario[]).includes(usuario.rol);
  if (!esInspector && !consulta) redirect("/acceso");

  const [estado] = await prisma.$queryRaw<Estado[]>`
    SELECT
      c."inspeccionTecnicaConcluidaEn", c."campoFinalizadoEn", c."preReporteGeneradoEn", c."revisionInspectorFinalEn",
      c."reporteLimiteEn", c."reabiertaEn",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a WHERE a."inspeccionId"=${id} AND a."obligatoria"=true) AS "areasTotal",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a WHERE a."inspeccionId"=${id} AND a."obligatoria"=true AND a."estado"='REVISADA' AND a."resultado" IN ('SIN_HALLAZGOS','CON_HALLAZGOS','NO_APLICA')) AS "areasCompletas",
      (SELECT COUNT(*)::int FROM "ProtocoloInspeccionPaso" p WHERE p."inspeccionId"=${id} AND p."obligatorio"=true) AS "procesosTotal",
      (SELECT COUNT(*)::int FROM "ProtocoloInspeccionPaso" p WHERE p."inspeccionId"=${id} AND p."obligatorio"=true AND p."estado" IN ('COMPLETADO','NO_APLICA')) AS "procesosCompletos",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=${id}) AS "hallazgos",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=${id} AND (SELECT COUNT(*) FROM "Fotografia" f WHERE f."hallazgoId"=h."id") BETWEEN 1 AND 4 AND nullif(btrim(coalesce(h."descripcion",'')),'') IS NOT NULL) AS "hallazgosCompletos",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a JOIN "FotografiaArea" fa ON fa."areaId"=a."id" WHERE a."inspeccionId"=${id} AND a."codigo" IN ('FACHADA_FRONTAL','FACHADA_PRINCIPAL')) AS "fotosFachada",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a JOIN "FotografiaArea" fa ON fa."areaId"=a."id" WHERE a."inspeccionId"=${id} AND a."codigo" IN ('FACHADA_FRONTAL','FACHADA_PRINCIPAL') AND fa."candidataPortada"=true) AS "portadaFachada",
      (SELECT COUNT(*)::int FROM "OperacionCampoSync" s WHERE s."inspeccionId"=${id} AND s."estado" <> 'PROCESADA') AS "syncPendientes"
    FROM "InspeccionControlV2" c WHERE c."inspeccionId"=${id} LIMIT 1
  `;

  const reabiertaEn = estado?.reabiertaEn ? new Date(estado.reabiertaEn) : null;
  const firmasVigentes = inspeccion.firmas.filter(
    (firma) => !reabiertaEn || new Date(firma.firmadaEn) >= reabiertaEn,
  );
  const firmaInspector = firmasVigentes.some((f) => f.tipo.toLowerCase().includes("inspector"));
  const firmaCliente = firmasVigentes.some((f) => f.tipo.toLowerCase().includes("cliente"));
  const firmasListas = firmaInspector && firmaCliente;
  const observacionesDireccion = inspeccion.revisiones.filter(
    (revision) => revision.decision === "DEVUELTO_INSPECTOR" && Boolean(revision.comentario),
  );
  const observacionDireccionActual = observacionesDireccion[0] ?? null;

  const tecnicoListo = Boolean(
    estado && estado.areasTotal > 0 && estado.areasCompletas === estado.areasTotal &&
    estado.procesosTotal > 0 && estado.procesosCompletos === estado.procesosTotal &&
    estado.hallazgos === estado.hallazgosCompletos &&
    (estado.portadaFachada === 1 || estado.fotosFachada === 0) && estado.syncPendientes === 0
  );
  const inspeccionConcluida = Boolean(estado?.inspeccionTecnicaConcluidaEn);
  const preReporteRevisado = Boolean(estado?.preReporteGeneradoEn);
  const campoTerminado = Boolean(estado?.campoFinalizadoEn);
  const revisionInspectorFinal = Boolean(estado?.revisionInspectorFinalEn);
  const listoCampo = tecnicoListo && preReporteRevisado && firmasListas;
  const ahora = new Date();
  const limite = estado?.reporteLimiteEn ? new Date(estado.reporteLimiteEn) : null;
  const minutosRestantes = limite ? Math.floor((limite.getTime() - ahora.getTime()) / 60000) : null;
  const vencido = minutosRestantes !== null && minutosRestantes < 0;
  const horasRestantes = minutosRestantes !== null ? Math.max(0, Math.floor(minutosRestantes / 60)) : null;
  const mins = minutosRestantes !== null ? Math.max(0, minutosRestantes % 60) : null;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}/flujo`} className="text-sm font-black text-cyan-300">← Flujo V1</Link>
          <span className="rounded-full border border-white/10 px-4 py-2 text-xs font-black text-slate-300">CIERRE V1</span>
        </div>

        <header className="mt-6">
          <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-300">Método Certeza Habitacional</p>
          <h1 className="mt-2 text-3xl font-black">Cierre de inspección en sitio</h1>
          <p className="mt-2 text-sm text-slate-400">{inspeccion.folio} · {inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? inspeccion.inmueble?.direccion ?? "Inmueble"}</p>
        </header>

        {(query.ok || query.error) && <div className={`mt-5 rounded-2xl p-4 text-sm font-bold ${query.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>{query.error ?? query.ok}</div>}

        {observacionDireccionActual && inspeccion.estado === EstadoInspeccion.EN_PROCESO && (
          <section className="mt-5 rounded-3xl border border-rose-300/20 bg-rose-300/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-rose-300">Observaciones de Dirección pendientes de atender</p>
            <h2 className="mt-2 text-xl font-black">PRE REPORTE devuelto al Inspector</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {observacionDireccionActual.comentario}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              {observacionDireccionActual.usuario.nombre} · {new Date(observacionDireccionActual.creadaEn).toLocaleString("es-MX")}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/panel/inspecciones/${id}/revision-final-inspector`} className="rounded-xl bg-rose-300 px-4 py-3 text-sm font-black text-slate-950">
                ATENDER OBSERVACIONES
              </Link>
              <Link href={`/panel/inspecciones/${id}/reporte-v1`} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-black">
                REVISAR PRE REPORTE
              </Link>
            </div>
          </section>
        )}

        {reabiertaEn && !firmasListas && (
          <section className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-amber-300">Reporte devuelto por Dirección</p>
            <h2 className="mt-2 text-lg font-black">Las firmas anteriores ya no son vigentes</h2>
            <p className="mt-2 text-sm text-amber-100">Después de corregir el reporte, el Inspector y el cliente deben firmar nuevamente antes de reenviarlo a Dirección.</p>
            <Link href={`/panel/inspecciones/${id}/firmas`} className="mt-4 inline-block rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950">Registrar nuevas firmas →</Link>
          </section>
        )}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card titulo="Áreas" valor={`${estado?.areasCompletas ?? 0}/${estado?.areasTotal ?? 0}`} ok={Boolean(estado && estado.areasTotal > 0 && estado.areasCompletas === estado.areasTotal)} />
          <Card titulo="Procesos" valor={`${estado?.procesosCompletos ?? 0}/${estado?.procesosTotal ?? 0}`} ok={Boolean(estado && estado.procesosTotal > 0 && estado.procesosCompletos === estado.procesosTotal)} />
          <Card titulo="Hallazgos completos" valor={`${estado?.hallazgosCompletos ?? 0}/${estado?.hallazgos ?? 0}`} ok={Boolean(estado && estado.hallazgosCompletos === estado.hallazgos)} />
          <Card titulo="Firmas vigentes" valor={`${Number(firmaInspector) + Number(firmaCliente)}/2`} ok={firmasListas} />
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-slate-900 p-5">
          <h2 className="text-xl font-black">Semáforo de salida</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Linea ok={(estado?.fotosFachada ?? 0) >= 4} texto={`Fachada: ${estado?.fotosFachada ?? 0}/4 fotografías`} />
            <Linea ok={(estado?.portadaFachada ?? 0) === 1} texto={`Foto de portada: ${(estado?.portadaFachada ?? 0) === 1 ? "seleccionada" : "pendiente"}`} />
            <Linea ok={(estado?.syncPendientes ?? 0) === 0} texto={`Sincronización: ${estado?.syncPendientes ?? 0} pendientes`} />
            <Linea ok={firmaInspector} texto={`Firma Inspector: ${firmaInspector ? "vigente" : "pendiente"}`} />
            <Linea ok={firmaCliente} texto={`Firma cliente: ${firmaCliente ? "vigente" : "pendiente"}`} />
            <Linea ok={listoCampo} texto={listoCampo ? "Visita lista para terminar o reenviar" : "Aún existen requisitos pendientes"} />
          </div>
        </section>

        {!campoTerminado && inspeccion.estado === EstadoInspeccion.EN_PROCESO && !tecnicoListo && (
          <section className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-6">
            <p className="text-xs font-black uppercase tracking-widest text-amber-300">Inspección en proceso</p>
            <h2 className="mt-2 text-xl font-black">Continúa con la inspección</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Durante esta etapa sólo se muestran las herramientas de captura técnica. Las opciones de revisión y ajuste permanecen ocultas.
            </p>
          </section>
        )}

        {!campoTerminado && inspeccion.estado === EstadoInspeccion.EN_PROCESO && tecnicoListo && !inspeccionConcluida && (
          <section className="mt-5 rounded-3xl border border-emerald-300/20 bg-emerald-300/5 p-6">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Inspección técnica completada al 100%</p>
            <h2 className="mt-2 text-xl font-black">Concluir inspección</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Mientras la inspección está en ejecución no se muestran opciones de revisión ni ajuste. Cuando el Inspector confirme que terminó la inspección, se habilitará la revisión preliminar.
            </p>
            {esInspector && (
              <form action={concluirInspeccionTecnicaV1} className="mt-4">
                <input type="hidden" name="inspeccionId" value={id}/>
                <button className="rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950">CONCLUIR INSPECCIÓN</button>
              </form>
            )}
          </section>
        )}

        {!campoTerminado && inspeccion.estado === EstadoInspeccion.EN_PROCESO && tecnicoListo && inspeccionConcluida && (
          <section className="mt-5 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-6">
            <p className="text-xs font-black uppercase tracking-widest text-cyan-300">Después de concluir la inspección</p>
            <h2 className="mt-2 text-xl font-black">Reporte preliminar para revisión en sitio</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Antes de cerrar la visita, el Inspector debe revisar el PRE REPORTE completo y corregir cualquier omisión todavía estando en el inmueble.
            </p>
            <div className="mt-4">
              <Link href={`/panel/inspecciones/${id}/reporte-v1`} className="inline-block rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950">
                {preReporteRevisado ? "VOLVER A VER PRE-REPORTE INTEGRAL ✓" : "GENERAR / REVISAR PRE-REPORTE INTEGRAL"}
              </Link>
              {preReporteRevisado && (
                <Link href={`/panel/inspecciones/${id}/revision-final-inspector`} className="ml-3 inline-block rounded-xl border border-violet-300/30 px-4 py-3 text-sm font-black text-violet-200">
                  PASAR A REVISIÓN Y AJUSTES
                </Link>
              )}
            </div>
            <p className={`mt-4 text-sm font-bold ${preReporteRevisado ? "text-emerald-300" : "text-amber-300"}`}>
              {preReporteRevisado ? "✓ PRE REPORTE revisado y confirmado en sitio." : "Pendiente: confirmar la revisión preliminar antes de cerrar la visita."}
            </p>
          </section>
        )}

        {!campoTerminado && inspeccion.estado === EstadoInspeccion.EN_PROCESO && inspeccionConcluida && (
          <section className={`mt-5 rounded-3xl border p-6 ${firmasListas ? "border-emerald-300/20 bg-emerald-300/5" : "border-cyan-300/20 bg-cyan-300/5"}`}>
            <p className="text-xs font-black uppercase tracking-widest text-cyan-300">Registro de firmas</p>
            <h2 className="mt-2 text-xl font-black">Firmas del Inspector y del Cliente</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Las firmas forman parte del expediente y aparecerán en el PRE-REPORTE y en el REPORTE FINAL. Deben quedar registradas antes de cerrar la visita.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/panel/inspecciones/${id}/firmas`} className="inline-block rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950">
                {firmasListas ? "CONSULTAR / ACTUALIZAR FIRMAS ✓" : "REGISTRAR FIRMAS"}
              </Link>
              <span className={`rounded-xl border px-4 py-3 text-sm font-black ${firmaInspector ? "border-emerald-300/30 text-emerald-300" : "border-amber-300/30 text-amber-300"}`}>Inspector: {firmaInspector ? "registrada" : "pendiente"}</span>
              <span className={`rounded-xl border px-4 py-3 text-sm font-black ${firmaCliente ? "border-emerald-300/30 text-emerald-300" : "border-amber-300/30 text-amber-300"}`}>Cliente: {firmaCliente ? "registrada" : "pendiente"}</span>
            </div>
          </section>
        )}

        {!campoTerminado && inspeccion.estado === EstadoInspeccion.EN_PROCESO && inspeccionConcluida && (
          <section className={`mt-5 rounded-3xl border p-6 ${listoCampo ? "border-emerald-300/20 bg-emerald-300/5" : "border-amber-300/20 bg-amber-300/5"}`}>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Etapa 2 · cierre de visita</p>
            <h2 className="mt-2 text-xl font-black">Terminar trabajo de campo</h2>
            <p className="mt-2 text-sm text-slate-300">Se habilita únicamente después de confirmar el PRE REPORTE en sitio y contar con las firmas vigentes. Al cerrar la visita inicia la última revisión del Inspector.</p>
            {esInspector && <form action={terminarTrabajoCampoV1} className="mt-4"><input type="hidden" name="inspeccionId" value={id}/><button disabled={!listoCampo} className="rounded-xl bg-emerald-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-30">CERRAR VISITA Y PASAR A REVISIÓN FINAL</button></form>}
          </section>
        )}

        {campoTerminado && (
          <section id="envio-autorizacion" className={`scroll-mt-24 mt-5 rounded-3xl border p-6 ${vencido ? "border-rose-300/20 bg-rose-300/5" : "border-cyan-300/20 bg-cyan-300/5"}`}>
            <p className="text-xs font-black uppercase tracking-widest text-cyan-300">Etapa 3 · última revisión del Inspector</p>
            <h2 className="mt-2 text-2xl font-black">{vencido ? "Plazo objetivo vencido" : `${horasRestantes} h ${mins} min restantes`}</h2>
            {limite && <p className="mt-2 text-sm text-slate-300">Límite registrado: {limite.toLocaleString("es-MX")}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/panel/inspecciones/${id}/reporte-v1`} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-black">CONSULTAR PRE REPORTE</Link>
              <Link href={`/panel/inspecciones/${id}/revision-final-inspector`} className="rounded-xl bg-violet-300 px-4 py-3 text-sm font-black text-slate-950">REVISIÓN Y AJUSTES</Link>
              <Link href={`/panel/inspecciones/${id}/reporte-evidencias`} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-black">AJUSTAR EVIDENCIAS</Link>
            </div>
            {esInspector && inspeccion.estado === EstadoInspeccion.EN_PROCESO && (
              <>
                <form action={confirmarRevisionFinalInspectorV1} className="mt-5">
                  <input type="hidden" name="inspeccionId" value={id}/>
                  <button disabled={!firmasListas || revisionInspectorFinal} className="w-full rounded-xl bg-violet-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-30">
                    {revisionInspectorFinal ? "REVISIÓN FINAL DEL INSPECTOR CONFIRMADA ✓" : "CONFIRMAR REVISIÓN Y AJUSTES DEL INSPECTOR"}
                  </button>
                </form>
                <form action={enviarReporteDireccionV1} className="mt-3">
                  <input type="hidden" name="inspeccionId" value={id}/>
                  <button disabled={!firmasListas || !revisionInspectorFinal} className="w-full rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-30">CERRAR PRE REPORTE Y ENVIAR A DIRECCIÓN</button>
                </form>
                <p className="mt-3 text-xs leading-5 text-slate-400">Después del envío, el Inspector queda en sólo lectura. Dirección podrá autorizar o devolver el reporte con retroalimentación y correcciones requeridas.</p>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function Card({ titulo, valor, ok }: { titulo: string; valor: string; ok: boolean }) {
  return <article className={`rounded-2xl border p-4 ${ok ? "border-emerald-300/15 bg-emerald-300/5" : "border-white/10 bg-slate-900"}`}><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{titulo}</p><p className={`mt-2 text-2xl font-black ${ok ? "text-emerald-300" : "text-amber-300"}`}>{valor}</p></article>;
}

function Linea({ ok, texto }: { ok: boolean; texto: string }) {
  return <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${ok ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-200"}`}>{ok ? "✓" : "•"} {texto}</div>;
}
