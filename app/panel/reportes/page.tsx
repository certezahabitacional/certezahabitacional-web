import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";
import { obtenerUsuarioConAlcanceZona } from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";

export default async function ReportesPanelPage() {
  const usuario = await obtenerUsuarioConAlcanceZona("/panel/reportes");
  if (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR) {
    redirect("/acceso");
  }
  const inspecciones = await prisma.inspeccion.findMany({
    select: {
      id: true, folio: true, estado: true, numeroInspeccion: true,
      actualizadoEn: true, direccion: true, ciudad: true,
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true } },
    },
    orderBy: { actualizadoEn: "desc" },
  });
  return <main className="mx-auto max-w-7xl px-6 py-10 text-white">
    <header className="mb-8">
      <p className="text-xs font-black uppercase tracking-widest text-cyan-300">Certeza Habitacional</p>
      <h1 className="mt-2 text-4xl font-black">REPORTES</h1>
      <p className="mt-2 text-slate-400">Acceso directo a los reportes de inspección. Los documentos aún no autorizados son de uso interno.</p>
    </header>
    <section className="space-y-3">
      {inspecciones.length === 0 && <p className="rounded-2xl bg-slate-900 p-8 text-slate-400">No hay inspecciones registradas.</p>}
      {inspecciones.map((i) => <article key={i.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-black text-cyan-300">{i.folio}</p>
          <h2 className="mt-1 font-bold">{i.cliente.nombre} · {i.inmueble?.alias ?? i.direccion}</h2>
          <p className="mt-1 text-sm text-slate-400">{i.ciudad} · {i.estado.replaceAll("_", " ")} · Inspección {i.numeroInspeccion}</p>
        </div>
        <Link href={`/panel/inspecciones/${i.id}/${i.numeroInspeccion === 1 ? "reporte-v1" : "reporte"}`} className="rounded-xl border border-cyan-300/40 px-5 py-3 text-center text-sm font-black text-cyan-200 hover:bg-cyan-300/10">VER REPORTE</Link>
      </article>)}
    </section>
  </main>;
}
