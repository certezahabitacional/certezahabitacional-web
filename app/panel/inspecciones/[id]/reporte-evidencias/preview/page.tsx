import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { ordenarYFiltrarFotografias, obtenerSeleccionEvidenciaReporte } from "@/lib/evidencia-reporte";
import { prisma } from "@/lib/prisma";

export default async function Preview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { id: true, rol: true, activo: true } });
  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: {
      folio: true,
      inspector: { select: { usuario: { select: { gerenteId: true, coordinadorId: true } } } },
      hallazgos: {
        orderBy: { creadoEn: "asc" },
        select: { id: true, area: true, titulo: true, fotografias: { orderBy: { creadaEn: "asc" }, select: { id: true, descripcion: true } } },
      },
    },
  });
  if (!inspeccion) notFound();

  const permitido = usuario.rol === RolUsuario.DIRECTOR ||
    (usuario.rol === RolUsuario.GERENTE && inspeccion.inspector?.usuario.gerenteId === usuario.id) ||
    (usuario.rol === RolUsuario.COORDINADOR && inspeccion.inspector?.usuario.coordinadorId === usuario.id);
  if (!permitido) redirect("/acceso");

  const seleccion = await obtenerSeleccionEvidenciaReporte(id);
  const hallazgos = inspeccion.hallazgos.map((h) => ({ ...h, fotografias: ordenarYFiltrarFotografias(h.fotografias, seleccion) }));
  const total = hallazgos.reduce((n, h) => n + h.fotografias.length, 0);

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
    <div className="mx-auto max-w-5xl">
      <Link href={`/panel/inspecciones/${id}/reporte-evidencias`} className="font-black text-violet-300">← Volver al editor</Link>
      <header className="mt-5 rounded-3xl border border-white/10 bg-slate-900 p-6">
        <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">Vista previa editorial · {inspeccion.folio}</p>
        <h1 className="mt-2 text-3xl font-black">Evidencias que alimentarán el reporte</h1>
        <p className="mt-2 text-sm text-slate-400">{seleccion.activa ? `Selección editorial activa · ${total} foto(s).` : `Compatibilidad histórica · ${total} foto(s); se conservan todas.`}</p>
      </header>
      {!seleccion.disponible && <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm font-bold text-amber-200">La tabla editorial aún no está habilitada. Esta vista conserva el comportamiento histórico.</div>}
      <section className="mt-6 space-y-4">
        {hallazgos.map((h, i) => <article key={h.id} className="rounded-3xl border border-white/10 bg-slate-900 p-5">
          <p className="text-xs font-black text-cyan-300">Hallazgo {i + 1} · {h.area}</p>
          <h2 className="mt-1 text-xl font-black">{h.titulo}</h2>
          <div className="mt-4 space-y-2">{h.fotografias.map((f, j) => <div key={f.id} className="rounded-xl bg-slate-950 p-3 text-sm"><b>Foto {j + 1}</b> · {f.descripcion || "Sin descripción"}{seleccion.notaPorFotografia.get(f.id) ? <p className="mt-1 text-xs text-violet-300">Nota editorial: {seleccion.notaPorFotografia.get(f.id)}</p> : null}</div>)}</div>
          {h.fotografias.length === 0 && <p className="mt-4 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-200">Sin fotografías seleccionadas para la salida editorial.</p>}
        </article>)}
      </section>
    </div>
  </main>;
}
