import Link from "next/link";
import { EstadoCotizacion, EstadoInspeccion, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona, puedeAccederZona } from "@/lib/alcance-zona";
import { obtenerAsignacionesInspeccion } from "@/lib/asignaciones-inspeccion";
import { calcularResumenFinancieroCaja } from "@/lib/caja-finanzas";
import { prisma } from "@/lib/prisma";
import { crearInspeccion } from "./actions";
import CotizacionSelect from "./CotizacionSelect";
import ZonaInspectorSelect from "./ZonaInspectorSelect";

type SearchParams=Promise<{error?:string;antecedenteId?:string}>;
const ROLES_AGENDAR_INSPECCION = new Set<RolUsuario>([RolUsuario.DIRECTOR,RolUsuario.ADMINISTRADOR]);

export default async function NuevaInspeccionPage({searchParams}:{searchParams:SearchParams}){
  const usuarioActual=await obtenerUsuarioConAlcanceZona("/panel/inspecciones/nueva");
  if(!ROLES_AGENDAR_INSPECCION.has(usuarioActual.rol))redirect("/acceso");
  const params=await searchParams,antecedenteId=params.antecedenteId?.trim()||"";
  const antecedente=antecedenteId?await prisma.inspeccion.findUnique({where:{id:antecedenteId},select:{id:true,folio:true,estado:true,clienteId:true,inmuebleId:true,inspectorId:true,plantillaId:true,zonaId:true,numeroInspeccion:true,cliente:{select:{nombre:true}},inmueble:{select:{alias:true,direccion:true}}}}):null;
  if(antecedenteId&&!antecedente)redirect(`/panel/inspecciones/nueva?error=${encodeURIComponent("La inspección antecedente no existe.")}`);
  if(antecedente&&!puedeAccederZona(usuarioActual,antecedente.zonaId))redirect("/acceso");

  const zonaObligatoria=usuarioActual.rol===RolUsuario.DIRECTOR?(antecedente?.zonaId??null):usuarioActual.zonaId;
  const [cotizacionesBase,inspectores,gerentes,coordinadores,zonas,plantillas]=await Promise.all([
    prisma.cotizacion.findMany({
      where:{
        estado:EstadoCotizacion.AUTORIZADA,
        inmuebleId:{not:null},
        OR:[{inspeccion:null},{inspeccion:{estado:EstadoInspeccion.PROGRAMADA}}],
        ...(zonaObligatoria?{zonaId:zonaObligatoria}:{}),
        ...(antecedente?{clienteId:antecedente.clienteId,inmuebleId:antecedente.inmuebleId}:{})
      },
      select:{
        id:true,folio:true,clienteId:true,inmuebleId:true,zonaId:true,total:true,montoPagado:true,excepcionApertura:true,excepcionInicio:true,
        cliente:{select:{nombre:true}},
        inmueble:{select:{alias:true}},
        inspeccion:{select:{id:true,folio:true,estado:true,fechaProgramada:true}}
      },
      orderBy:{autorizadaEn:"desc"}
    }),
    prisma.inspector.findMany({where:{activo:true,usuario:{activo:true,rol:RolUsuario.INSPECTOR,...(zonaObligatoria?{zonaId:zonaObligatoria}:{})}},select:{id:true,usuario:{select:{nombre:true,zonaId:true}}},orderBy:{creadoEn:"asc"}}),
    prisma.usuario.findMany({where:{activo:true,rol:RolUsuario.GERENTE,...(zonaObligatoria?{zonaId:zonaObligatoria}:{})},select:{id:true,nombre:true,zonaId:true},orderBy:{nombre:"asc"}}),
    prisma.usuario.findMany({where:{activo:true,rol:RolUsuario.COORDINADOR,...(zonaObligatoria?{zonaId:zonaObligatoria}:{})},select:{id:true,nombre:true,zonaId:true},orderBy:{nombre:"asc"}}),
    prisma.zona.findMany({where:{activa:true,...(usuarioActual.rol===RolUsuario.DIRECTOR?{}:{id:usuarioActual.zonaId!})},select:{id:true,nombre:true,codigo:true},orderBy:{nombre:"asc"}}),
    prisma.plantillaInspeccion.findMany({where:{activa:true},orderBy:{nombre:"asc"}}),
  ]);
  const asignacionesAntecedente=antecedente?await obtenerAsignacionesInspeccion(antecedente.id):null;
  const cotizaciones=cotizacionesBase
    .map(c=>({c,resumen:calcularResumenFinancieroCaja({importe:Number(c.total),pagado:Number(c.montoPagado),excepcionApertura:c.excepcionApertura,excepcionInicio:c.excepcionInicio,tieneInspeccion:Boolean(c.inspeccion),fechaAgendada:c.inspeccion?.fechaProgramada??null})}))
    .filter(x=>x.resumen.puedeAgendar)
    .map(({c,resumen})=>({
      id:c.id,folio:c.folio,clienteId:c.clienteId,clienteNombre:c.cliente.nombre,inmuebleId:c.inmuebleId!,inmuebleAlias:c.inmueble?.alias??"Inmueble",total:resumen.importe,montoPagado:resumen.pagado,excepcionApertura:c.excepcionApertura,
      modo:c.inspeccion?"RETOMAR" as const:"NUEVA" as const,
      inspeccionFolio:c.inspeccion?.folio??null,
      fechaProgramada:c.inspeccion?.fechaProgramada?.toISOString()??null,
    }));
  const puedeConfigurarPlantillas=true;
  const puedeIniciarDesdeAgenda=usuarioActual.rol===RolUsuario.DIRECTOR;
  return <main className="min-h-screen bg-slate-950 px-6 py-8 text-white"><div className="mx-auto max-w-5xl"><div className="flex justify-between gap-4"><Link href="/panel/inspecciones" className="text-sm font-black text-cyan-300">← Inspecciones</Link>{puedeConfigurarPlantillas&&<Link href="/panel/configuracion/plantillas" className="text-sm font-black text-amber-300">Configurar plantillas</Link>}</div><p className="mt-7 text-xs font-black uppercase tracking-[0.3em] text-amber-300">Programación operativa</p><h1 className="mt-3 text-4xl font-black">{antecedente?`Agendar inspección V${antecedente.numeroInspeccion+1}`:"Agendar Inspección"}</h1><p className="mt-3 text-slate-400">Puedes crear una nueva agenda o retomar una cotización cuya inspección siga PROGRAMADA para completar asignaciones o reagendarla. Al retomar, los datos que dejes sin cambio conservan su valor actual.</p>{params.error&&<div className="mt-6 rounded-2xl border border-rose-400/20 p-4 text-rose-200">{params.error}</div>}
  <form action={crearInspeccion} className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-slate-900 p-7">{antecedente&&<><input type="hidden" name="antecedenteId" value={antecedente.id}/><div className="grid gap-4 rounded-2xl border border-cyan-300/20 p-5 md:grid-cols-2"><Dato label="Antecedente" value={`V${antecedente.numeroInspeccion} · ${antecedente.folio}`}/><Dato label="Cliente" value={antecedente.cliente.nombre}/><Dato label="Inmueble" value={antecedente.inmueble?.alias??"Inmueble"}/><Dato label="Dirección" value={antecedente.inmueble?.direccion??"—"}/></div></>}{cotizaciones.length?<CotizacionSelect cotizaciones={cotizaciones}/>:<div className="rounded-2xl border border-amber-300/20 p-5 text-amber-200">No hay cotizaciones autorizadas y financieramente habilitadas dentro de la zona permitida.</div>}<CampoSelect name="plantillaId" label="Plantilla de inspección" defaultValue={antecedente?.plantillaId??""} options={plantillas.map(p=>({value:p.id,label:p.nombre}))}/><ZonaInspectorSelect zonas={zonas} inspectores={inspectores} gerentes={gerentes} coordinadores={coordinadores} zonaInicial={antecedente?.zonaId??usuarioActual.zonaId??""} inspectorInicial={antecedente?.inspectorId??""} gerenteInicial={asignacionesAntecedente?.gerenteId??""} coordinadorInicial={asignacionesAntecedente?.coordinadorId??""} zonaRequired={false}/><label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Fecha y hora</span><input name="fechaProgramada" type="datetime-local" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"/><span className="mt-2 block text-xs text-slate-500">Obligatoria para una agenda nueva. Al retomar una inspección PROGRAMADA, déjala vacía para conservar la fecha actual o captura otra fecha para reagendar.</span></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Observaciones</span><textarea name="observaciones" rows={4} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"/></label><div className="grid gap-3 md:grid-cols-2"><button type="submit" name="accion" value="agendar" disabled={!cotizaciones.length} className="w-full rounded-full bg-cyan-400 px-6 py-3 font-black text-slate-950 disabled:opacity-40">AGENDAR / ACTUALIZAR</button><button type="submit" name="accion" value="iniciar" disabled={!cotizaciones.length||!puedeIniciarDesdeAgenda} title={puedeIniciarDesdeAgenda?"Guardar cambios y abrir revisión final":"Solo Dirección puede iniciar una inspección"} className="w-full rounded-full border border-amber-300/40 px-6 py-3 font-black text-amber-200 disabled:cursor-not-allowed disabled:opacity-40">GUARDAR E IR A REVISIÓN FINAL{!puedeIniciarDesdeAgenda?" · SOLO DIRECCIÓN":""}</button></div></form></div></main>;
}
function CampoSelect({name,label,options,defaultValue=""}:{name:string;label:string;options:{value:string;label:string}[];defaultValue?:string}){return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">{label}</span><select name={name} defaultValue={defaultValue} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"><option value="">Conservar actual al retomar / seleccionar para nueva</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;}
function Dato({label,value}:{label:string;value:string}){return <div><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-1 font-bold">{value}</p></div>;}
