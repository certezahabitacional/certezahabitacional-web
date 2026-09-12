import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MINIMO_EVIDENCIAS = 4;

export default async function EvidenciaControlPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      rol: true,
      activo: true,
      inspector: { select: { id: true } },
    },
  });
  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: {
      id: true,
      folio: true,
      estado: true,
      inspectorId: true,
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true } },
      hallazgos: {
        orderBy: [{ area: "asc" }, { creadoEn: "asc" }],
        select: {
          id: true,
          area: true,
          titulo: true,
          clasificacion: true,
          prioridad: true,
          fotografias: { select: { id: true } },
        },
      },
    },
  });
  if (!inspeccion) notFound();

  const esInspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.id) &&
    inspeccion.inspectorId === usuario.inspector?.id;

  const puedeVer =
    esInspectorAsignado ||
    usuario.rol === RolUsuario.DIRECTOR ||
    usuario.rol === RolUsuario.GERENTE ||
    usuario.rol === RolUsuario.COORDINADOR;
  if (!puedeVer) redirect("/acceso");

  const puedeCapturar =
    esInspectorAsignado && inspeccion.estado === EstadoInspeccion.EN_PROCESO;

  const completos = inspeccion.hallazgos.filter(
    (h) => h.fotografias.length >= MINIMO_EVIDENCIAS,
  ).length;
  const incompletos = inspeccion.hallazgos.length - completos;
  const faltantesTotales = inspeccion.hallazgos.reduce(
    (total, h) => total + Math.max(0, MINIMO_EVIDENCIAS - h.fotografias.length),
    0,
  );
  const avance = inspeccion.hallazgos.length
    ? Math.round((completos / inspeccion.hallazgos.length) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/panel/inspecciones/${id}`}
            className="text-sm font-black text-cyan-300"
          >
            ← Expediente
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/panel/inspecciones/${id}/preparacion`}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-black"
            >
              Guía técnica
            </Link>
            {puedeCapturar && (
              <Link
                href={`/panel/inspecciones/${id}/captura`}
                className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950"
              >
                Capturar hallazgos
              </Link>
            )}
          </div>
        </div>

        <p className="mt-7 text-xs font-black uppercase tracking-[0.25em] text-amber-300">
          Control de evidencia
        </p>
        <h1 className="mt-2 text-4xl font-black">4 fotografías por hallazgo</h1>
        <p className="mt-3 text-slate-400">
          {inspeccion.folio} · {inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? "Inmueble"}
        </p>

        <section className="mt-7 grid gap-4 sm:grid-cols-4">
          <Resumen titulo="Hallazgos" valor={String(inspeccion.hallazgos.length)} />
          <Resumen titulo="Completos" valor={String(completos)} />
          <Resumen titulo="Incompletos" valor={String(incompletos)} />
          <Resumen titulo="Fotos faltantes" valor={String(faltantesTotales)} />
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-black">Avance de evidencia mínima</p>
              <p className="mt-1 text-sm text-slate-400">
                Un hallazgo se considera listo al contar con 4 o más fotografías asociadas.
              </p>
            </div>
            <span className={`rounded-full px-4 py-2 font-black ${avance === 100 && inspeccion.hallazgos.length > 0 ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>
              {avance}%
            </span>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-cyan-300" style={{ width: `${avance}%` }} />
          </div>
        </section>

        <div className="mt-7 space-y-3">
          {inspeccion.hallazgos.map((hallazgo, index) => {
            const cantidad = hallazgo.fotografias.length;
            const faltan = Math.max(0, MINIMO_EVIDENCIAS - cantidad);
            const completo = cantidad >= MINIMO_EVIDENCIAS;
            return (
              <article
                key={hallazgo.id}
                className={`rounded-3xl border p-5 ${completo ? "border-emerald-400/20 bg-emerald-400/5" : "border-amber-400/20 bg-slate-900"}`}
              >
                <div className="grid gap-4 md:grid-cols-[70px_1fr_auto] md:items-center">
                  <span className="font-mono text-lg font-black text-cyan-300">
                    #{String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="flex flex-wrap gap-2 text-xs font-black">
                      <span className="rounded-full bg-white/5 px-2 py-1 text-slate-400">{hallazgo.area}</span>
                      <span className="rounded-full bg-white/5 px-2 py-1 text-slate-400">{hallazgo.clasificacion}</span>
                      <span className="rounded-full bg-white/5 px-2 py-1 text-slate-400">{hallazgo.prioridad}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-black">{hallazgo.titulo}</h2>
                    <p className={`mt-2 text-sm font-bold ${completo ? "text-emerald-300" : "text-amber-300"}`}>
                      {cantidad}/4 evidencias {completo ? "· completo" : `· faltan ${faltan}`}
                    </p>
                  </div>
                  {puedeCapturar ? (
                    <Link
                      href={`/panel/inspecciones/${id}/evidencias?hallazgoId=${hallazgo.id}`}
                      className={`rounded-xl px-4 py-3 text-center text-sm font-black ${completo ? "border border-white/10 text-slate-300" : "bg-cyan-300 text-slate-950"}`}
                    >
                      {completo ? "Ver evidencias" : `Agregar ${faltan}`}
                    </Link>
                  ) : (
                    <span className="text-xs font-bold text-slate-500">
                      {completo ? "Evidencia completa" : "Evidencia pendiente"}
                    </span>
                  )}
                </div>
              </article>
            );
          })}

          {inspeccion.hallazgos.length === 0 && (
            <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-slate-400">
              Todavía no hay hallazgos. Registra el primer hallazgo para iniciar el control de evidencia.
            </div>
          )}
        </div>

        {inspeccion.hallazgos.length > 0 && incompletos === 0 && (
          <div className="mt-7 rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-6 text-emerald-200">
            <p className="font-black">Evidencia mínima completa</p>
            <p className="mt-2 text-sm">
              Todos los hallazgos tienen al menos 4 fotografías. Este requisito ya está listo para el cierre de captura.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function Resumen({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900 p-5">
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className="mt-2 text-3xl font-black text-cyan-300">{valor}</p>
    </article>
  );
}
