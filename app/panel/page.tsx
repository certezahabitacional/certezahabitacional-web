import Link from "next/link";
import { EstadoInspeccion, Prisma, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona, zonaEfectivaId } from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";

export default async function PanelPage({ searchParams }: { searchParams: Promise<{ zonaId?: string }> }) {
  const usuarioActual=await obtenerUsuarioConAlcanceZona("/panel");
  const rol=usuarioActual.rol;
  const esDirector=rol===RolUsuario.DIRECTOR,esAdministrador=rol===RolUsuario.ADMINISTRADOR,esVendedor=rol===RolUsuario.VENDEDOR,esGerente=rol===RolUsuario.GERENTE,esCoordinador=rol===RolUsuario.COORDINADOR;
  if(esVendedor) redirect("/panel/pre-cotizaciones");
  if(!esDirector&&!esAdministrador&&!esGerente&&!esCoordinador) redirect("/acceso");
  const p=await searchParams;
  const zonaId=zonaEfectivaId(usuarioActual,p.zonaId);
  const zonas=esDirector?await prisma.zona.findMany({where:{activa:true},select:{id:true,nombre:true,codigo:true},orderBy:{nombre:"asc"}}):[];

  let alcanceRol:Prisma.InspeccionWhereInput={};
  if(esGerente) alcanceRol={inspector:{usuario:{gerenteId:usuarioActual.id}}};
  if(esCoordinador) alcanceRol={inspector:{usuario:{coordinadorId:usuarioActual.id}}};
  const alcanceInspecciones:Prisma.InspeccionWhereInput={AND:[zonaId?{zonaId}:{},alcanceRol]};

  const [inspeccionesPorEstado,recientes,clientes,certificados]=await Promise.all([
    prisma.inspeccion.groupBy({by:["estado"],where:alcanceInspecciones,_count:{_all:true}}),
    prisma.inspeccion.findMany({where:alcanceInspecciones,select:{id:true,folio:true,tipoInmueble:true,ciudad:true,estado:true,ish:true,zona:{select:{nombre:true,codigo:true}},cliente:{select:{nombre:true}}},orderBy:{actualizadoEn:"desc"},take:6}),
    esDirector||esAdministrador?prisma.cliente.count({where:zonaId?{OR:[{cotizaciones:{some:{zonaId}}},{inspecciones:{some:{zonaId}}}]}:{}}):Promise.resolve(0),
    esDirector?prisma.certificado.groupBy({by:["vigente"],where:zonaId?{inspeccion:{zonaId}}:{},_count:{_all:true}}):Promise.resolve(null),
  ]);
  const cantidad=(estado:EstadoInspeccion)=>inspeccionesPorEstado.find(x=>x.estado===estado)?._count._all??0;
  const activas=cantidad(EstadoInspeccion.EN_PROCESO),programadas=cantidad(EstadoInspeccion.PROGRAMADA),reportesPendientes=cantidad(EstadoInspeccion.REPORTE_PENDIENTE),certificadosEmitidos=certificados?.reduce((t,x)=>t+x._count._all,0)??0;
  const indicadores=esDirector?[{titulo:"Inspecciones activas",valor:activas,detalle:"Actualmente en proceso"},{titulo:"Programadas",valor:programadas,detalle:"Pendientes de iniciar"},{titulo:"Reportes pendientes",valor:reportesPendientes,detalle:"Por completar o emitir"},{titulo:"Clientes registrados",valor:clientes,detalle:"Dentro del filtro de zona"},{titulo:"Certificados emitidos",valor:certificadosEmitidos,detalle:"Dentro del filtro de zona"}]:esAdministrador?[{titulo:"Inspecciones activas",valor:activas,detalle:"Seguimiento administrativo"},{titulo:"Programadas",valor:programadas,detalle:"Servicios agendados"},{titulo:"Reportes pendientes",valor:reportesPendientes,detalle:"Seguimiento del proceso"},{titulo:"Clientes registrados",valor:clientes,detalle:"Dentro de tu zona"}]:[{titulo:"Inspecciones activas",valor:activas,detalle:"Dentro de tu alcance"},{titulo:"Programadas",valor:programadas,detalle:"Dentro de tu alcance"},{titulo:"Reportes pendientes",valor:reportesPendientes,detalle:"Dentro de tu alcance"}];
  const tituloPanel=esDirector?"Dashboard ejecutivo":esAdministrador?"Panel de administración":esGerente?"Panel de gerencia":"Panel de coordinación técnica";
  const alcanceTexto=esDirector?(zonaId?zonas.find(z=>z.id===zonaId)?.nombre??"Zona seleccionada":"Todas las zonas"):usuarioActual.zona?.nombre??"Zona no asignada";

  return <main className="min-h-screen bg-slate-950 px-6 py-8 text-white"><div className="mx-auto max-w-7xl"><header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">Certeza Habitacional</p><h1 className="mt-2 text-4xl font-black">{tituloPanel}</h1><p className="mt-2 text-slate-400">Alcance actual: <span className="font-black text-amber-300">{alcanceTexto}</span></p></div>{esDirector&&<form className="flex gap-2"><select name="zonaId" defaultValue={p.zonaId??""} className="rounded-full border border-white/10 bg-slate-900 px-5 py-3"><option value="">Todas las zonas</option>{zonas.map(z=><option key={z.id} value={z.id}>{z.nombre} · {z.codigo}</option>)}</select><button className="rounded-full border border-white/15 px-5 font-black">Aplicar</button></form>}</header>
  <section className={`mt-8 grid gap-5 sm:grid-cols-2 ${esDirector?"xl:grid-cols-5":indicadores.length===4?"xl:grid-cols-4":"xl:grid-cols-3"}`}>{indicadores.map(i=><Metrica key={i.titulo}{...i}/>)}</section>
  <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900"><header className="border-b border-white/10 p-6"><h2 className="text-xl font-black">Actividad reciente</h2><p className="mt-1 text-sm text-slate-500">Últimas inspecciones dentro de {alcanceTexto}.</p></header>{recientes.length===0?<p className="p-12 text-center text-slate-400">Aún no hay inspecciones dentro de este alcance.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="bg-slate-950 text-xs uppercase text-slate-500"><tr><th className="px-6 py-4">Folio</th><th className="px-6 py-4">Zona</th><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Inmueble</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4">ISH</th></tr></thead><tbody>{recientes.map(i=><tr key={i.id} className="border-t border-white/10"><td className="px-6 py-5"><Link href={`/panel/inspecciones/${i.id}`} className="font-black text-cyan-300">{i.folio}</Link></td><td className="px-6 py-5">{i.zona?`${i.zona.nombre} · ${i.zona.codigo}`:"—"}</td><td className="px-6 py-5 font-bold">{i.cliente.nombre}</td><td className="px-6 py-5 text-slate-400">{i.tipoInmueble}<div className="text-xs text-slate-600">{i.ciudad}</div></td><td className="px-6 py-5">{i.estado.replaceAll("_"," ")}</td><td className="px-6 py-5 font-black">{i.ish!==null?Number(i.ish).toFixed(0):"—"}</td></tr>)}</tbody></table></div>}</section></div></main>;
}
function Metrica({titulo,valor,detalle}:{titulo:string;valor:number;detalle:string}){return <article className="rounded-3xl border border-white/10 bg-slate-900 p-6"><p className="text-sm font-bold text-slate-400">{titulo}</p><p className="mt-4 text-4xl font-black text-cyan-300">{String(valor).padStart(2,"0")}</p><p className="mt-2 text-sm text-slate-500">{detalle}</p></article>;}
