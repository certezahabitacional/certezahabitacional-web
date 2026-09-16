import { EstadoDecisionRevision, RolUsuario, TipoDecisionRevision } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona } from "@/lib/alcance-zona";
import { usuarioAsignadoAInspeccion } from "@/lib/asignaciones-inspeccion";
import { prisma } from "@/lib/prisma";
import { obtenerEstadoExpedienteRevision } from "@/lib/validacion-expediente-certeza";
import {
  aprobarDireccion,
  aprobarGerencia,
  darVistoBuenoCoordinador,
  devolverAInspector,
  devolverACoordinacion,
  levantarBloqueoYAprobar,
  noAprobarDireccion,
  retenerParaAuditoria,
} from "../actions";
import { devolverReporteInspectorV1 } from "../cierre-v1/actions";

type SearchParams = Promise<{ ok?: string; error?: string }>;

export default async function RevisionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const usuario = await obtenerUsuarioConAlcanceZona(`/panel/inspecciones/${id}/revision`);

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: {
      id: true, folio: true, estado: true, numeroInspeccion: true,
      liberacionBloqueada: true, motivoBloqueoLiberacion: true,
      requiereCoordinador: true, requiereGerenteZona: true,
      inspector: { select: { usuario: { select: { nombre: true } } } },
      revisiones: {
        orderBy: { creadaEn: "desc" },
        select: { id: true, rol: true, decision: true, estado: true, comentario: true, creadaEn: true, usuario: { select: { nombre: true } } },
      },
    },
  });

  if (!inspeccion) notFound();
  if (usuario.rol === RolUsuario.CLIENTE || usuario.rol === RolUsuario.ADMINISTRADOR || usuario.rol === RolUsuario.VENDEDOR) redirect("/acceso");
  if (usuario.rol === RolUsuario.COORDINADOR && !(await usuarioAsignadoAInspeccion(id, usuario.id, "COORDINADOR"))) redirect("/acceso");
  if (usuario.rol === RolUsuario.GERENTE && !(await usuarioAsignadoAInspeccion(id, usuario.id, "GERENTE"))) redirect("/acceso");
  if (usuario.rol === RolUsuario.INSPECTOR && !(await usuarioAsignadoAInspeccion(id, usuario.id, "INSPECTOR"))) redirect("/acceso");

  const estadoRevision = await obtenerEstadoExpedienteRevision(id);
  if (!estadoRevision) notFound();

  const vistoBuenoCoordinador = inspeccion.revisiones.some((r) => r.rol === RolUsuario.COORDINADOR && r.decision === TipoDecisionRevision.VISTO_BUENO && r.estado === EstadoDecisionRevision.VIGENTE);
  const aprobacionGerencia = inspeccion.revisiones.some((r) => r.rol === RolUsuario.GERENTE && r.decision === TipoDecisionRevision.APROBADO && r.estado === EstadoDecisionRevision.VIGENTE);
  const aprobacionDireccion = inspeccion.revisiones.some((r) => r.rol === RolUsuario.DIRECTOR && r.decision === TipoDecisionRevision.APROBADO && r.estado === EstadoDecisionRevision.VIGENTE);

  const pendienteRevision = inspeccion.estado === "REPORTE_PENDIENTE";
  const puedeCoordinar = usuario.rol === RolUsuario.COORDINADOR && inspeccion.requiereCoordinador;
  const puedeGerencia = usuario.rol === RolUsuario.GERENTE && inspeccion.requiereGerenteZona;
  const esDirector = usuario.rol === RolUsuario.DIRECTOR;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}`} className="text-sm font-bold text-cyan-300">← Volver al expediente</Link>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-slate-300">{inspeccion.folio} · V{inspeccion.numeroInspeccion}</span>
        </div>

        {query.ok && <p className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 font-bold text-emerald-300">{query.ok}</p>}
        {query.error && <p className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 font-bold text-rose-300">{query.error}</p>}

        <header className="mt-5 rounded-3xl border border-cyan-400/20 bg-slate-900 p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Control de revisión</p>
          <h1 className="mt-2 text-3xl font-black">Revisión y liberación Método Certeza®</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Esta pantalla usa la validación real del Método Certeza. V1 puede quedar completa sin defectos si toda la vivienda fue documentada; V2+ se valida por el seguimiento de pendientes heredados y los nuevos hallazgos que realmente existan.</p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <EstadoCard titulo="Captura técnica" completo={estadoRevision.capturaTecnicaCompleta} detalle={estadoRevision.usaMetodoCerteza ? "Método Certeza validado" : "Expediente histórico"} />
          <EstadoCard titulo="Firma Inspector" completo={estadoRevision.firmaInspector} detalle={estadoRevision.firmaInspector ? "Registrada" : "Pendiente"} />
          <EstadoCard titulo="Firma Cliente" completo={estadoRevision.firmaCliente} detalle={estadoRevision.firmaCliente ? "Registrada" : "Pendiente"} />
          <EstadoCard titulo="Expediente" completo={estadoRevision.completo} detalle={estadoRevision.completo ? "Listo para revisión" : "Incompleto"} />
        </section>

        {!estadoRevision.completo && <section className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-400/5 p-5"><p className="font-black text-amber-300">Pendientes antes de aprobar</p><div className="mt-3 space-y-2 text-sm text-amber-100">{estadoRevision.faltantes.map((faltante) => <p key={faltante}>• {faltante}</p>)}</div></section>}

        <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900 p-6">
          <div className="flex flex-wrap items-center gap-2"><Pill etiqueta="Coordinación" activo={vistoBuenoCoordinador} /><Pill etiqueta="Gerencia" activo={aprobacionGerencia} /><Pill etiqueta="Dirección" activo={aprobacionDireccion} /></div>
          <p className="mt-4 text-sm text-slate-400">Inspector asignado: <strong className="text-slate-200">{inspeccion.inspector?.usuario.nombre ?? "Sin asignar"}</strong>. Estado actual: <strong className="text-slate-200">{inspeccion.estado.replaceAll("_", " ")}</strong>.</p>
          {inspeccion.liberacionBloqueada && <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4"><p className="font-black text-rose-300">Liberación bloqueada por Dirección</p><p className="mt-2 text-sm text-slate-300">{inspeccion.motivoBloqueoLiberacion ?? "Sin motivo visible."}</p></div>}
        </section>

        {puedeCoordinar && pendienteRevision && !inspeccion.liberacionBloqueada && <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {estadoRevision.completo && !vistoBuenoCoordinador ? <form action={darVistoBuenoCoordinador} className="rounded-3xl border border-cyan-400/20 bg-slate-900 p-5"><input type="hidden" name="inspeccionId" value={id} /><h2 className="text-xl font-black">Visto bueno de Coordinación</h2><textarea name="comentario" rows={3} placeholder="Comentario opcional" className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" /><button className="mt-3 w-full rounded-full bg-cyan-300 px-5 py-3 font-black text-slate-950">Dar visto bueno técnico</button></form> : <div className="rounded-3xl border border-white/10 bg-slate-900 p-5 text-sm text-slate-400">{vistoBuenoCoordinador ? "Coordinación ya registró su visto bueno." : "Completa los pendientes antes de emitir visto bueno."}</div>}
          <form action={devolverAInspector} className="rounded-3xl border border-rose-400/20 bg-slate-900 p-5"><input type="hidden" name="inspeccionId" value={id} /><h2 className="text-xl font-black text-rose-300">Devolver al Inspector</h2><textarea name="comentario" required minLength={10} rows={3} placeholder="Motivo obligatorio" className="mt-4 w-full rounded-2xl border border-rose-400/20 bg-slate-950 px-4 py-3" /><button className="mt-3 w-full rounded-full border border-rose-400/40 px-5 py-3 font-black text-rose-300">Devolver para corrección</button></form>
        </section>}

        {puedeGerencia && pendienteRevision && !inspeccion.liberacionBloqueada && <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <form action={aprobarGerencia} className="rounded-3xl border border-emerald-400/20 bg-slate-900 p-5"><input type="hidden" name="inspeccionId" value={id} /><h2 className="text-xl font-black text-emerald-300">Aprobar y finalizar</h2><p className="mt-2 text-sm text-slate-400">{inspeccion.requiereCoordinador ? "Requiere visto bueno vigente de Coordinación." : "Esta inspección no requiere Coordinación previa."}</p><textarea name="comentario" rows={3} placeholder="Comentario opcional" className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" /><button disabled={!estadoRevision.completo || (inspeccion.requiereCoordinador && !vistoBuenoCoordinador)} className="mt-3 w-full rounded-full bg-emerald-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Aprobar y finalizar</button></form>
          {inspeccion.requiereCoordinador && vistoBuenoCoordinador && <form action={devolverACoordinacion} className="rounded-3xl border border-amber-400/20 bg-slate-900 p-5"><input type="hidden" name="inspeccionId" value={id} /><h2 className="text-xl font-black text-amber-300">Devolver a Coordinación</h2><textarea name="comentario" required minLength={10} rows={3} placeholder="Motivo obligatorio" className="mt-4 w-full rounded-2xl border border-amber-400/20 bg-slate-950 px-4 py-3" /><button className="mt-3 w-full rounded-full border border-amber-400/40 px-5 py-3 font-black text-amber-300">Devolver a Coordinación</button></form>}
        </section>}

        {esDirector && pendienteRevision && <section className="mt-6 rounded-3xl border border-violet-400/20 bg-violet-400/5 p-6"><h2 className="text-xl font-black text-violet-300">Dirección</h2>{inspeccion.liberacionBloqueada ? <form action={levantarBloqueoYAprobar} className="mt-4"><input type="hidden" name="inspeccionId" value={id} /><textarea name="comentario" required minLength={10} rows={3} placeholder="Motivo para levantar bloqueo y aprobar" className="w-full rounded-2xl border border-violet-300/20 bg-slate-950 px-4 py-3" /><button disabled={!estadoRevision.completo} className="mt-3 w-full rounded-full bg-violet-300 px-5 py-3 font-black text-slate-950 disabled:opacity-40">Levantar bloqueo y aprobar</button></form> : <div className={`mt-4 grid gap-4 ${inspeccion.numeroInspeccion === 1 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}><form action={aprobarDireccion} className="rounded-2xl bg-slate-950 p-4"><input type="hidden" name="inspeccionId" value={id} /><textarea name="comentario" rows={3} placeholder="Comentario opcional" className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" /><button disabled={!estadoRevision.completo} className="mt-3 w-full rounded-full bg-emerald-300 px-4 py-3 font-black text-slate-950 disabled:opacity-40">Aprobar y finalizar</button></form>{inspeccion.numeroInspeccion === 1 && <form action={devolverReporteInspectorV1} className="rounded-2xl bg-slate-950 p-4"><input type="hidden" name="inspeccionId" value={id} /><textarea name="comentario" required minLength={10} rows={3} placeholder="Correcciones requeridas al Inspector" className="w-full rounded-2xl border border-cyan-400/20 bg-slate-900 px-4 py-3" /><button className="mt-3 w-full rounded-full border border-cyan-400/40 px-4 py-3 font-black text-cyan-300">Devolver al Inspector</button></form>}<form action={noAprobarDireccion} className="rounded-2xl bg-slate-950 p-4"><input type="hidden" name="inspeccionId" value={id} /><textarea name="comentario" required minLength={10} rows={3} placeholder="Motivo de no aprobación" className="w-full rounded-2xl border border-rose-400/20 bg-slate-900 px-4 py-3" /><button className="mt-3 w-full rounded-full border border-rose-400/40 px-4 py-3 font-black text-rose-300">No aprobar</button></form><form action={retenerParaAuditoria} className="rounded-2xl bg-slate-950 p-4"><input type="hidden" name="inspeccionId" value={id} /><textarea name="comentario" required minLength={10} rows={3} placeholder="Motivo de auditoría" className="w-full rounded-2xl border border-amber-400/20 bg-slate-900 px-4 py-3" /><button className="mt-3 w-full rounded-full border border-amber-400/40 px-4 py-3 font-black text-amber-300">Retener para auditoría</button></form></div>}</section>}

        <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900 p-6"><h2 className="text-xl font-black">Historial de decisiones</h2>{inspeccion.revisiones.length === 0 ? <p className="mt-4 text-sm text-slate-500">Aún no hay decisiones registradas.</p> : <div className="mt-4 space-y-3">{inspeccion.revisiones.slice(0, 12).map((revision) => <article key={revision.id} className="rounded-2xl bg-slate-950 p-4"><div className="flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-cyan-400/10 px-3 py-1 text-cyan-300">{revision.rol}</span><span className="rounded-full bg-white/5 px-3 py-1 text-slate-300">{revision.decision.replaceAll("_", " ")}</span><span className="rounded-full bg-white/5 px-3 py-1 text-slate-500">{revision.estado}</span></div><p className="mt-2 text-sm text-slate-300">{revision.usuario.nombre}{revision.comentario ? ` · ${revision.comentario}` : ""}</p></article>)}</div>}</section>
      </div>
    </main>
  );
}

function EstadoCard({ titulo, completo, detalle }: { titulo: string; completo: boolean; detalle: string }) {
  return <div className={`rounded-2xl border p-4 ${completo ? "border-emerald-400/20 bg-emerald-400/5" : "border-amber-400/20 bg-amber-400/5"}`}><p className="text-xs font-black uppercase tracking-wider text-slate-500">{titulo}</p><p className={`mt-2 font-black ${completo ? "text-emerald-300" : "text-amber-300"}`}>{completo ? "COMPLETO" : "PENDIENTE"}</p><p className="mt-1 text-xs text-slate-400">{detalle}</p></div>;
}

function Pill({ etiqueta, activo }: { etiqueta: string; activo: boolean }) {
  return <span className={`rounded-full px-3 py-2 text-xs font-black ${activo ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 text-slate-500"}`}>{etiqueta}: {activo ? "APROBADO" : "PENDIENTE"}</span>;
}
