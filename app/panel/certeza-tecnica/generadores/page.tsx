import Link from "next/link";
import { EstadoProyectoGeneradores, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona } from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";

const etiquetasEstado: Record<EstadoProyectoGeneradores, string> = {
  NUEVO: "Nuevo",
  RECEPCION_DOCUMENTAL: "Recepción documental",
  EN_ANALISIS: "En análisis",
  CATALOGO_EN_REVISION: "Catálogo en revisión",
  EN_CUANTIFICACION: "En cuantificación",
  EN_REVISION_TECNICA: "En revisión técnica",
  LISTO_ENTREGA: "Listo para entrega",
  CERRADO: "Cerrado",
  INFORMACION_INCOMPLETA: "Información incompleta",
  SUSPENDIDO: "Suspendido",
  EN_ESPERA_CLIENTE: "En espera del cliente",
  PROYECTO_MODIFICADO: "Proyecto modificado",
};

export default async function GeneradoresCertezaTecnicaPage() {
  const usuarioActual = await obtenerUsuarioConAlcanceZona("/panel/certeza-tecnica/generadores");
  const puedeEntrar =
    usuarioActual.rol === RolUsuario.DIRECTOR ||
    usuarioActual.rol === RolUsuario.ADMINISTRADOR;

  if (!puedeEntrar) redirect("/acceso");

  const proyectos = await prisma.proyectoGeneradores.findMany({
    select: {
      id: true,
      codigo: true,
      nombre: true,
      clienteNombre: true,
      ubicacion: true,
      estado: true,
      fechaObjetivo: true,
      responsable: { select: { nombre: true, email: true } },
      _count: {
        select: {
          documentos: true,
          conceptos: true,
          generadores: true,
          solicitudes: true,
          inconsistencias: true,
        },
      },
    },
    orderBy: [{ actualizadoEn: "desc" }, { creadoEn: "desc" }],
  });

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">
              Certeza Técnica · Presupuestos y Costos
            </p>
            <h1 className="mt-2 text-4xl font-black">Generadores y Cuantificación</h1>
            <p className="mt-3 max-w-4xl text-sm text-slate-400 sm:text-base">
              Control de proyectos, documentos, catálogo, cantidades, generadores,
              revisiones y trazabilidad técnica.
            </p>
          </div>

          <Link
            href="/panel/certeza-tecnica/generadores/nuevo"
            className="inline-flex items-center justify-center rounded-2xl bg-amber-300 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-200"
          >
            Nuevo proyecto
          </Link>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["Proyectos", proyectos.length],
            ["Documentos", proyectos.reduce((s, p) => s + p._count.documentos, 0)],
            ["Conceptos", proyectos.reduce((s, p) => s + p._count.conceptos, 0)],
            ["Generadores", proyectos.reduce((s, p) => s + p._count.generadores, 0)],
            ["Solicitudes", proyectos.reduce((s, p) => s + p._count.solicitudes, 0)],
            ["Inconsistencias", proyectos.reduce((s, p) => s + p._count.inconsistencias, 0)],
          ].map(([etiqueta, valor]) => (
            <div key={String(etiqueta)} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">{etiqueta}</p>
              <p className="mt-2 text-3xl font-black text-amber-200">{valor}</p>
            </div>
          ))}
        </section>

        <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-lg font-black">Proyectos</h2>
          </div>

          {proyectos.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-lg font-black">Todavía no hay proyectos registrados.</p>
              <p className="mt-2 text-sm text-slate-400">
                Crea el primer proyecto para iniciar la recepción documental y el control del catálogo.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full border-collapse text-left">
                <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-4">Código</th>
                    <th className="px-4 py-4">Proyecto</th>
                    <th className="px-4 py-4">Cliente</th>
                    <th className="px-4 py-4">Ubicación</th>
                    <th className="px-4 py-4">Estado</th>
                    <th className="px-4 py-4">Responsable</th>
                    <th className="px-4 py-4">Control</th>
                  </tr>
                </thead>
                <tbody>
                  {proyectos.map((proyecto) => (
                    <tr key={proyecto.id} className="border-t border-white/5 hover:bg-white/[0.025]">
                      <td className="px-4 py-4 font-mono text-xs font-black text-amber-300">{proyecto.codigo}</td>
                      <td className="px-4 py-4 font-bold">{proyecto.nombre}</td>
                      <td className="px-4 py-4">{proyecto.clienteNombre}</td>
                      <td className="px-4 py-4 text-slate-300">{proyecto.ubicacion ?? "—"}</td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-200">
                          {etiquetasEstado[proyecto.estado]}
                        </span>
                      </td>
                      <td className="px-4 py-4">{proyecto.responsable?.nombre ?? proyecto.responsable?.email ?? "Sin asignar"}</td>
                      <td className="px-4 py-4 text-sm text-slate-300">
                        {proyecto._count.documentos} doc. · {proyecto._count.conceptos} conceptos · {proyecto._count.generadores} gen.
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
