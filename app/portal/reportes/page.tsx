import Link from "next/link";
import { obtenerClienteActual } from "@/lib/cliente-actual";
import { prisma } from "@/lib/prisma";
import { inspeccionLiberadaParaCliente } from "@/lib/portal-inspecciones";

export default async function PortalReportesPage() {
  const cliente = await obtenerClienteActual();
  const inspecciones = await prisma.inspeccion.findMany({
    where: inspeccionLiberadaParaCliente(cliente.id, cliente.zonaId),
    select: { id:true,folio:true,numeroInspeccion:true,direccion:true,ciudad:true,inmueble:{select:{alias:true}} },
    orderBy: { actualizadoEn: "desc" },
  });
  return <main className="mx-auto max-w-7xl px-6 py-10">
    <h1 className="text-4xl font-black">MIS REPORTES</h1>
    <p className="mt-2 text-slate-400">Solo se muestran reportes autorizados y liberados de tus propios inmuebles.</p>
    <section className="mt-8 space-y-4">
      {inspecciones.length === 0 && <p className="rounded-2xl bg-slate-900 p-8">Aún no tienes reportes liberados.</p>}
      {inspecciones.map((i)=><div key={i.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-black text-cyan-300">{i.folio}</p><p className="mt-1">{i.inmueble?.alias??i.direccion} · {i.ciudad}</p></div>
        <Link href={`/portal/inspecciones/${i.id}`} className="rounded-xl border border-cyan-300/40 px-5 py-3 text-center font-black text-cyan-300">VER REPORTE</Link>
      </div>)}
    </section>
  </main>;
}
