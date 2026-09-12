import Link from "next/link";
import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { finalizarCapturaGuiada } from "./actions";

async function leerGuia(id: string) {
  try {
    const tabla = await prisma.$queryRaw<Array<{ tabla: string | null }>>`SELECT to_regclass('public."GuiaInspeccionItem"')::text AS "tabla"`;
    if (!tabla[0]?.tabla) return { habilitada: false, total: 0, completos: 0 };
    const [r] = await prisma.$queryRaw<Array<{ total: number; completos: number }>>`
      SELECT COUNT(*)::int AS "total", COUNT(*) FILTER (WHERE "completado")::int AS "completos"
      FROM "GuiaInspeccionItem" WHERE "inspeccionId"=${id}`;
    return { habilitada: true, total: Number(r?.total ?? 0), completos: Number(r?.completos ?? 0) };
  } catch { return { habilitada: false, total: 0, completos: 0 }; }
}

export default async function FlujoCampoPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{ok?:string;error?:string}>}) {
  const {id}=await params; const q=await searchParams; const session=await auth();
  if(!session?.user?.id) redirect("/login");
  const usuario=await prisma.usuario.findUnique({where:{id:session.user.id},select:{rol:true,activo:true,inspector:{select:{id:true}}}});
  if(!usuario?.activo) redirect("/acceso");
  const inspeccion=await prisma.inspeccion.findUnique({where:{id},select:{id:true,folio:true,estado:true,inspectorId:true,cliente:{select:{nombre:true}},inmueble:{select:{alias:true}},hallazgos:{select:{id:true,fotografias:{select:{id:true}}}},firmas:{select:{tipo:true}}}});
  if(!inspeccion) notFound();
  const esInspector=usuario.rol===RolUsuario.INSPECTOR&&usuario.inspector?.id===inspeccion.inspectorId;
  const consulta=usuario.rol===RolUsuario.DIRECTOR||usuario.rol===RolUsuario.GERENTE||usuario.rol===RolUsuario.COORDINADOR;
  if(!esInspector&&!consulta) redirect("/acceso");

  const guia=await leerGuia(id);
  const guiaLista=guia.habilitada?guia.total>0&&guia.completos===guia.total:true;
  const hallazgos=inspeccion.hallazgos.length;
  const evidenciaCompleta=hallazgos>0&&inspeccion.hallazgos.every(h=>h.fotografias.length>=4);
  const fotosFaltantes=inspeccion.hallazgos.reduce((n,h)=>n+Math.max(0,4-h.fotografias.length),0);
  const firmaInspector=inspeccion.firmas.some(f=>f.tipo.toLowerCase().includes("inspector"));
  const firmaCliente=inspeccion.firmas.some(f=>f.tipo.toLowerCase().includes("cliente"));
  const firmasListas=firmaInspector&&firmaCliente;
  const listo=inspeccion.estado===EstadoInspeccion.EN_PROCESO&&guiaLista&&hallazgos>0&&evidenciaCompleta&&firmasListas;

  const pasos=[
    {n:1,t:"Recorrido técnico",ok:guiaLista,d:guia.habilitada?`${guia.completos}/${guia.total} conceptos revisados`:"Guía técnica pendiente de habilitar en base de datos",href:`/panel/inspecciones/${id}/preparacion`},
    {n:2,t:"Hallazgos",ok:hallazgos>0,d:`${hallazgos} hallazgo(s) registrados`,href:`/panel/inspecciones/${id}/captura`},
    {n:3,t:"Evidencias",ok:evidenciaCompleta,d:evidenciaCompleta?"Todos los hallazgos tienen 4+ fotos":`${fotosFaltantes} fotografía(s) faltantes para el mínimo`,href:`/panel/inspecciones/${id}/evidencia-control`},
    {n:4,t:"Firmas",ok:firmasListas,d:`Inspector: ${firmaInspector?'sí':'pendiente'} · Cliente: ${firmaCliente?'sí':'pendiente'}`,href:`/panel/inspecciones/${id}/firmas`},
  ];

  return <main className="min-h-screen bg-slate-950 px-5 py-8 text-white"><div className="mx-auto max-w-5xl">
    <Link href={`/panel/inspecciones/${id}`} className="text-sm font-black text-cyan-300">← Expediente</Link>
    <p className="mt-7 text-xs font-black uppercase tracking-[.25em] text-amber-300">Flujo operativo de campo</p>
    <h1 className="mt-2 text-4xl font-black">{inspeccion.folio}</h1><p className="mt-2 text-slate-400">{inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias??"Inmueble"}</p>
    {(q.ok||q.error)&&<p className={`mt-5 rounded-2xl p-4 font-bold ${q.error?'bg-rose-400/10 text-rose-300':'bg-emerald-400/10 text-emerald-300'}`}>{q.error??q.ok}</p>}
    <div className="mt-8 space-y-4">{pasos.map(p=><Link key={p.n} href={p.href} className={`grid gap-3 rounded-3xl border p-5 transition md:grid-cols-[55px_1fr_auto] md:items-center ${p.ok?'border-emerald-400/20 bg-emerald-400/5':'border-white/10 bg-slate-900 hover:border-cyan-300/30'}`}><span className={`grid h-11 w-11 place-items-center rounded-full font-black ${p.ok?'bg-emerald-300 text-slate-950':'bg-slate-800 text-cyan-300'}`}>{p.ok?'✓':p.n}</span><div><h2 className="text-lg font-black">{p.t}</h2><p className="mt-1 text-sm text-slate-400">{p.d}</p></div><span className="text-sm font-black text-cyan-300">Abrir →</span></Link>)}</div>
    <section className={`mt-7 rounded-3xl border p-6 ${listo?'border-emerald-300/25 bg-emerald-300/5':'border-amber-300/20 bg-amber-300/5'}`}><h2 className="text-xl font-black">Entrega a revisión</h2>{listo?<><p className="mt-2 text-sm text-emerald-100">Recorrido, hallazgos, evidencia mínima y firmas están completos. El Inspector puede entregar el expediente.</p>{esInspector&&<form action={finalizarCapturaGuiada} className="mt-5"><input type="hidden" name="inspeccionId" value={id}/><button className="rounded-full bg-emerald-300 px-6 py-3 font-black text-slate-950">Finalizar captura y enviar a revisión</button></form>}</>:<p className="mt-2 text-sm text-amber-100">Completa los pasos pendientes. El sistema no habilitará la entrega mientras falte algún requisito.</p>}</section>
  </div></main>;
}
