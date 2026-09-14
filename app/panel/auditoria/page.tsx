import Link from "next/link";
import { RolUsuario, TipoEvento } from "@prisma/client";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona } from "@/lib/alcance-zona";
import { puede } from "@/lib/permisos";
import { prisma } from "@/lib/prisma";

const ZONA_AUDITORIA=process.env.AUDITORIA_TIME_ZONE??"America/Hermosillo";
const etiquetas:Record<TipoEvento,string>={LOGIN:"Inicio de sesión",LOGOUT:"Cierre de sesión",CREAR:"Creación",EDITAR:"Edición",ELIMINAR:"Eliminación",EMITIR_CERTIFICADO:"Certificado emitido",REVOCAR_CERTIFICADO:"Certificado revocado",REACTIVAR_CERTIFICADO:"Certificado reactivado",SUBIR_EVIDENCIA:"Evidencia registrada",ELIMINAR_EVIDENCIA:"Evidencia eliminada",FIRMAR:"Firma registrada",DESCARGAR_REPORTE:"Reporte consultado",FINALIZAR_CAPTURA:"Captura finalizada",REVISION_INSPECCION:"Revisión de inspección",BLOQUEAR_LIBERACION:"Liberación bloqueada",DESBLOQUEAR_LIBERACION:"Liberación desbloqueada"};
const inicio=(f:string)=>fromZonedTime(`${f}T00:00:00`,ZONA_AUDITORIA);const fin=(f:string)=>fromZonedTime(`${f}T23:59:59.999`,ZONA_AUDITORIA);

export default async function AuditoriaPage({searchParams}:{searchParams:Promise<{tipo?:string;texto?:string;desde?:string;hasta?:string;zonaId?:string}>}){
  const usuario=await obtenerUsuarioConAlcanceZona("/panel/auditoria");
  if(usuario.rol!==RolUsuario.DIRECTOR||!puede(usuario.rol,"AUDITORIA_VER_TOTAL"))redirect("/acceso");
  const q=await searchParams,texto=q.texto?.trim()??"",tipo=q.tipo&&Object.values(TipoEvento).includes(q.tipo as TipoEvento)?q.tipo as TipoEvento:undefined,desde=q.desde?inicio(q.desde):undefined,hasta=q.hasta?fin(q.hasta):undefined,zonaId=(q.zonaId??"").trim()||undefined;
  const zonas=await prisma.zona.findMany({where:{activa:true},select:{id:true,nombre:true,codigo:true},orderBy:{nombre:"asc"}});

  let alcanceZona:any={};
  if(zonaId){
    const [inspecciones,cotizaciones,usuariosZona,clientesZona]=await Promise.all([
      prisma.inspeccion.findMany({where:{zonaId},select:{id:true}}),
      prisma.cotizacion.findMany({where:{zonaId},select:{id:true}}),
      prisma.usuario.findMany({where:{zonaId},select:{id:true}}),
      prisma.cliente.findMany({where:{OR:[{cotizaciones:{some:{zonaId}}},{inspecciones:{some:{zonaId}}}]},select:{id:true}}),
    ]);
    const inspeccionIds=inspecciones.map(x=>x.id),cotizacionIds=cotizaciones.map(x=>x.id),usuarioIds=usuariosZona.map(x=>x.id),clienteIds=clientesZona.map(x=>x.id);
    alcanceZona={OR:[
      {inspeccionId:{in:inspeccionIds.length?inspeccionIds:["__none__"]}},
      {entidad:"Cotizacion",entidadId:{in:cotizacionIds.length?cotizacionIds:["__none__"]}},
      {entidad:"Cliente",entidadId:{in:clienteIds.length?clienteIds:["__none__"]}},
      {entidad:"Usuario",entidadId:{in:usuarioIds.length?usuarioIds:["__none__"]}},
      {usuarioId:{in:usuarioIds.length?usuarioIds:["__none__"]}},
    ]};
  }
  const filtro:any={AND:[alcanceZona,tipo?{tipo}:{},desde||hasta?{creadoEn:{gte:desde,lte:hasta}}:{},texto?{OR:[{descripcion:{contains:texto,mode:"insensitive"}},{entidad:{contains:texto,mode:"insensitive"}},{usuario:{nombre:{contains:texto,mode:"insensitive"}}},{usuario:{email:{contains:texto,mode:"insensitive"}}}]}:{}]};
  const inicioHoy=fromZonedTime(formatInTimeZone(new Date(),ZONA_AUDITORIA,"yyyy-MM-dd'T'00:00:00"),ZONA_AUDITORIA);
  const [eventos,eventosHoy,certificadosRevocados,certificadosEmitidos]=await Promise.all([
    prisma.eventoAuditoria.findMany({where:filtro,include:{usuario:{select:{nombre:true,email:true,rol:true,zona:{select:{nombre:true,codigo:true}}}},inspeccion:{select:{zona:{select:{nombre:true,codigo:true}}}}},orderBy:{creadoEn:"desc"},take:250}),
    prisma.eventoAuditoria.count({where:{AND:[alcanceZona,{creadoEn:{gte:inicioHoy}}]}}),
    prisma.eventoAuditoria.count({where:{AND:[alcanceZona,{tipo:TipoEvento.REVOCAR_CERTIFICADO}]}}),
    prisma.eventoAuditoria.count({where:{AND:[alcanceZona,{tipo:TipoEvento.EMITIR_CERTIFICADO}]}}),
  ]);
  const zonaNombre=zonaId?zonas.find(z=>z.id===zonaId)?.nombre??"Zona seleccionada":"Todas las zonas";
  return <main className="min-h-screen bg-slate-950 px-5 py-8 text-white"><div className="mx-auto max-w-7xl"><Link href="/panel" className="font-bold text-cyan-300">← Volver al panel</Link><header className="mt-6"><p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">Control y trazabilidad</p><h1 className="mt-3 text-4xl font-black">Bitácora de auditoría</h1><p className="mt-3 text-slate-400">Dirección conserva acceso total; la consulta puede separarse por zona. Alcance actual: <b className="text-amber-300">{zonaNombre}</b>.</p></header><section className="mt-8 grid gap-4 sm:grid-cols-3"><Metrica titulo="Eventos de hoy" valor={eventosHoy}/><Metrica titulo="Certificados emitidos" valor={certificadosEmitidos}/><Metrica titulo="Certificados revocados" valor={certificadosRevocados}/></section>
  <form className="mt-8 grid gap-4 rounded-3xl border border-white/10 bg-slate-900 p-6 lg:grid-cols-[1fr_220px_220px_160px_160px_auto]"><input name="texto" defaultValue={texto} placeholder="Buscar usuario, descripción o entidad..." className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"/><select name="tipo" defaultValue={tipo??""} className="rounded-2xl border border-white/10 bg-slate-950 px-4"><option value="">Todos los eventos</option>{Object.values(TipoEvento).map(v=><option key={v} value={v}>{etiquetas[v]}</option>)}</select><select name="zonaId" defaultValue={zonaId??""} className="rounded-2xl border border-white/10 bg-slate-950 px-4"><option value="">Todas las zonas</option>{zonas.map(z=><option key={z.id} value={z.id}>{z.nombre} · {z.codigo}</option>)}</select><input type="date" name="desde" defaultValue={q.desde??""} className="rounded-2xl border border-white/10 bg-slate-950 px-4"/><input type="date" name="hasta" defaultValue={q.hasta??""} className="rounded-2xl border border-white/10 bg-slate-950 px-4"/><button className="rounded-full bg-cyan-400 px-6 font-black text-slate-950">Filtrar</button></form>
  <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900"><div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-left"><thead className="bg-slate-950 text-xs uppercase text-slate-400"><tr><th className="p-4">Fecha</th><th className="p-4">Zona</th><th className="p-4">Evento</th><th className="p-4">Usuario</th><th className="p-4">Entidad</th><th className="p-4">Descripción</th><th className="p-4">IP</th></tr></thead><tbody>{eventos.map(e=>{const z=e.inspeccion?.zona??e.usuario?.zona;return <tr key={e.id} className="border-t border-white/10 align-top"><td className="p-4 whitespace-nowrap text-sm text-slate-400">{formatInTimeZone(e.creadoEn,ZONA_AUDITORIA,"dd/MM/yyyy hh:mm:ss a")}</td><td className="p-4 text-sm">{z?`${z.nombre} · ${z.codigo}`:"Global / derivada de entidad"}</td><td className="p-4"><span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">{etiquetas[e.tipo]}</span></td><td className="p-4 text-sm"><b>{e.usuario?.nombre??"Sistema"}</b><div className="text-xs text-slate-500">{e.usuario?.email??""}</div></td><td className="p-4 text-sm"><b>{e.entidad}</b><div className="max-w-44 truncate text-xs text-slate-500">{e.entidadId??""}</div></td><td className="max-w-xl p-4 text-sm text-slate-300">{e.descripcion}</td><td className="p-4 text-sm text-slate-500">{e.ip??"No disponible"}</td></tr>})}{!eventos.length&&<tr><td colSpan={7} className="p-14 text-center text-slate-500">No existen eventos con estos filtros.</td></tr>}</tbody></table></div></section></div></main>;
}
function Metrica({titulo,valor}:{titulo:string;valor:number}){return <article className="rounded-3xl border border-white/10 bg-slate-900 p-6"><p className="text-sm font-bold text-slate-400">{titulo}</p><p className="mt-2 text-4xl font-black text-cyan-300">{valor}</p></article>;}
