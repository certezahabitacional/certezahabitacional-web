import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Control = {
  inspeccionTecnicaConcluidaEn: Date | null;
  campoFinalizadoEn: Date | null;
  preReporteGeneradoEn: Date | null;
  revisionInspectorFinalEn: Date | null;
};

export default async function RevisionFinalInspectorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
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
    },
  });
  if (!inspeccion) notFound();
  if (inspeccion.numeroInspeccion !== 1) redirect(`/panel/inspecciones/${id}`);

  const esInspector =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    usuario.inspector?.id === inspeccion.inspectorId;
  const esDirector = usuario.rol === RolUsuario.DIRECTOR;
  if (!esInspector && !esDirector) redirect("/acceso");

  const [control] = await prisma.$queryRaw<Control[]>`
    SELECT "inspeccionTecnicaConcluidaEn","campoFinalizadoEn","preReporteGeneradoEn","revisionInspectorFinalEn"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${id}
    LIMIT 1
  `;
  const [versiones] = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COUNT(*)::int AS "total"
    FROM "PreReporteInspeccion"
    WHERE "inspeccionId"=${id}
  `;

  if (!control?.inspeccionTecnicaConcluidaEn || Number(versiones?.total ?? 0) === 0) {
    redirect(`/panel/inspecciones/${id}/reporte-v1`);
  }

  const editable =
    inspeccion.estado === EstadoInspeccion.EN_PROCESO &&
    !control.revisionInspectorFinalEn;
  const preReporteVigente = Boolean(control.preReporteGeneradoEn);

  const herramientas = [
    {
      titulo: "Puntos técnicos 1–8",
      detalle: "Revisa y corrige conceptos, mediciones, clasificaciones, prioridades, lecturas y pruebas técnicas. Los conceptos cerrados pueden reabrirse y los NO APLICA pueden reactivarse.",
      href: `/panel/inspecciones/${id}/puntos-criticos`,
    },
    {
      titulo: "Hermeticidad",
      detalle: "Consulta las pruebas hidráulica y de gas y sus lecturas/evidencias registradas.",
      href: `/panel/inspecciones/${id}/puntos-criticos/hermeticidad?fase=cierre`,
    },
    {
      titulo: "Partidas y conceptos de la vivienda",
      detalle: "Regresa a cualquiera de las partidas ya inspeccionadas. Puedes editar conceptos cerrados, reactivar conceptos NO APLICA y volver a habilitar una partida deshabilitada mientras el expediente siga en revisión del Inspector.",
      href: `/panel/inspecciones/${id}/campo-v1`,
    },
    {
      titulo: "Resultados instrumentales",
      detalle: "Corrige resultados o textos registrados para las herramientas incluidas en el alcance contratado.",
      href: `/panel/inspecciones/${id}/instrumentos`,
    },
    {
      titulo: "Hallazgos y captura",
      detalle: "Revisa hallazgos, ubicación, clasificación, prioridad, descripción y evidencia técnica asociada.",
      href: `/panel/inspecciones/${id}/captura`,
    },
    {
      titulo: "Selección y orden de evidencias del reporte",
      detalle: "Ajusta la selección, orden y presentación de fotografías que se integrarán al documento.",
      href: `/panel/inspecciones/${id}/reporte-evidencias`,
    },
    {
      titulo: "Foto de fachada y evidencias de áreas",
      detalle: "Consulta la evidencia de las áreas y la fotografía seleccionada para portada.",
      href: `/panel/inspecciones/${id}/areas`,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}/reporte-v1`} className="text-sm font-black text-cyan-300">
            ← Pre-reporte integral
          </Link>
          <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-4 py-2 text-xs font-black text-violet-200">
            ÚLTIMA REVISIÓN Y AJUSTE DEL INSPECTOR
          </span>
        </div>

        <header className="mt-6 rounded-3xl border border-violet-300/20 bg-violet-300/5 p-6">
          <p className="text-xs font-black uppercase tracking-[.22em] text-violet-300">Etapa posterior al pre-reporte</p>
          <h1 className="mt-2 text-3xl font-black">Corrige cualquier dato capturado antes de enviar a Dirección</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            Lee el pre-reporte completo y usa esta etapa para regresar a cualquier dato técnico que hayas capturado o escrito durante la inspección. Puedes corregir evidencia, interpretación, mediciones, clasificación, prioridad, conceptos cerrados y elementos marcados como NO APLICA. Dirección conserva acceso absoluto de supervisión y corrección.
          </p>
          <p className="mt-4 text-sm font-bold text-slate-300">
            {inspeccion.folio} · {inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? inspeccion.inmueble?.direccion ?? "Inmueble"}
          </p>
        </header>

        {!preReporteVigente && (
          <section className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-5">
            <p className="font-black text-amber-200">El pre-reporte cambió después de una corrección</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Algún dato fue reabierto o modificado. Cuando termines los ajustes, vuelve al pre-reporte integral para revisar la versión actualizada y confirmarla nuevamente.
            </p>
            <Link href={`/panel/inspecciones/${id}/reporte-v1`} className="mt-4 inline-block rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950">
              REGENERAR / REVISAR PRE-REPORTE ACTUALIZADO
            </Link>
          </section>
        )}

        {control.revisionInspectorFinalEn && (
          <section className="mt-5 rounded-3xl border border-emerald-300/20 bg-emerald-300/5 p-5 text-sm text-emerald-100">
            La revisión final del Inspector ya fue confirmada. El expediente queda en modo de consulta hasta su envío o devolución por Dirección.
          </section>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {herramientas.map((item) => (
            <article key={item.titulo} className="rounded-3xl border border-white/10 bg-slate-900 p-5">
              <h2 className="text-xl font-black">{item.titulo}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.detalle}</p>
              {editable ? (
                <Link href={item.href} className="mt-4 inline-block rounded-xl border border-cyan-300/30 px-4 py-3 text-sm font-black text-cyan-200">
                  ABRIR PARA REVISAR / AJUSTAR
                </Link>
              ) : (
                <Link href={item.href} className="mt-4 inline-block rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-slate-400">
                  CONSULTAR
                </Link>
              )}
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-6">
          <h2 className="text-xl font-black">Secuencia para terminar esta etapa</h2>
          <ol className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
            <li><strong>1.</strong> Lee el pre-reporte integral completo.</li>
            <li><strong>2.</strong> Corrige cualquier dato, concepto, evidencia o interpretación que lo requiera.</li>
            <li><strong>3.</strong> Si hiciste cambios, vuelve a generar/revisar el pre-reporte actualizado.</li>
            <li><strong>4.</strong> Regresa al cierre V1 y confirma la última revisión del Inspector.</li>
            <li><strong>5.</strong> Envía el expediente a Dirección para revisión, autorización o retroalimentación.</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/panel/inspecciones/${id}/reporte-v1`} className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950">
              VER PRE-REPORTE INTEGRAL
            </Link>
            <Link href={`/panel/inspecciones/${id}/cierre-v1`} className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950">
              VOLVER AL CIERRE V1
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
