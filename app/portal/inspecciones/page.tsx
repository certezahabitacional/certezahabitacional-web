import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerClienteActual } from "@/lib/cliente-actual";
import { inspeccionLiberadaParaCliente } from "@/lib/portal-inspecciones";

function formatoFecha(fecha: Date, zonaHoraria: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: zonaHoraria }).format(fecha);
}

export default async function PortalInspeccionesPage() {
  const cliente = await obtenerClienteActual();
  const inspecciones = await prisma.inspeccion.findMany({
    where: inspeccionLiberadaParaCliente(cliente.id),
    include: {
      inmueble: true,
      inspector: { include: { usuario: true } },
      certificado: true,
      _count: { select: { hallazgos: true, fotografias: true, firmas: true } },
    },
    orderBy: { actualizadoEn: "desc" },
  });

  return <main className="mx-auto max-w-7xl px-6 py-10">
    <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Portal del cliente</p><h1 className="mt-2 text-4xl font-black">Mis inspecciones</h1><p className="mt-2 text-slate-400">Aquí aparecen únicamente expedientes cerrados, autorizados y con certificado vigente.</p></div><Link href="/portal" className="rounded-full border border-white/10 px-5 py-3 text-sm font-bold">Volver al inicio</Link></header>
    {inspecciones.length === 0 ? <section className="mt-8 rounded-3xl border border-white/10 bg-slate-900 p-12 text-center"><h2 className="text-2xl font-black">No hay inspecciones liberadas</h2><p className="mt-2 text-slate-500">Las inspecciones en proceso o pendientes de autorización no se muestran en el portal.</p></section> : <section className="mt-8 grid gap-6 lg:grid-cols-2">{inspecciones.map((i) => <article key={i.id} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900"><div className="border-b border-white/10 p-6"><div className="flex justify-between gap-4"><div><p className="text-sm font-black text-cyan-300">{i.folio}</p><h2 className="mt-2 text-xl font-black">{i.inmueble?.alias ?? i.tipoInmueble}</h2></div><span className="rounded-full bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-300">LIBERADA</span></div><p className="mt-4 text-sm text-slate-400">{i.direccion}, {i.ciudad}</p></div><div className="p-6"><dl className="grid gap-4 sm:grid-cols-2"><Dato label="Servicio" value={i.tipoServicio}/><Dato label="Fecha" value={formatoFecha(i.fechaProgramada,i.zonaHoraria)}/><Dato label="Inspector" value={i.inspector?.usuario.nombre ?? "—"}/><Dato label="ISH" value={i.ish !== null ? `${Number(i.ish).toFixed(0)} / 100` : "Sin evaluar"}/></dl><div className="mt-6 grid grid-cols-3 gap-3"><Contador valor={i._count.hallazgos} texto="Hallazgos"/><Contador valor={i._count.fotografias} texto="Evidencias"/><Contador valor={i._count.firmas} texto="Firmas"/></div><div className="mt-6 flex items-center justify-between border-t border-white/10 pt-6"><p className="text-sm font-bold text-emerald-300">Certificado vigente</p><Link href={`/portal/inspecciones/${i.id}`} className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950">Ver expediente</Link></div></div></article>)}</section>}
  </main>;
}
function Dato({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-slate-950 p-4"><dt className="text-xs font-black uppercase tracking-widest text-slate-600">{label}</dt><dd className="mt-2 text-sm font-bold text-slate-200">{value}</dd></div>}
function Contador({valor,texto}:{valor:number;texto:string}){return <div className="rounded-2xl bg-slate-950 p-4 text-center"><p className="text-2xl font-black text-cyan-300">{valor}</p><p className="mt-1 text-xs text-slate-500">{texto}</p></div>}
