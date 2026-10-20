import RecorridoConceptos, { RetomarRecorrido } from "@/components/inspecciones/RecorridoConceptos";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenerRecorridoConfirmado } from "@/lib/recorrido-plan-confirmado";
import ConceptoAreaCard, { type PuntoArea } from "./ConceptoAreaCard";
import { agregarPuntoInspectorV1, cerrarAreaConHallazgosV1, cerrarAreaSinHallazgosV1, deshabilitarPartidaAreaV1, reactivarPartidaAreaV1 } from "./actions";
import { concluirInspeccionTecnicaV1 } from "../cierre-v1/actions";

type Props = {usuarioId:string;inspeccionId:string;folio:string;query:{area?:string;ok?:string;error?:string};puedeCapturar:boolean};
export default async function RecorridoPlanConfirmado({usuarioId,inspeccionId:id,folio,query,puedeCapturar}:Props) {
  let partidas;
  try { partidas = await obtenerRecorridoConfirmado(id); }
  catch (e) {
    return <main className="min-h-screen bg-slate-950 p-6 text-white"><h1 className="text-3xl font-black">Revisar vinculación del plan</h1><p role="alert" className="mt-4 text-amber-200">{e instanceof Error ? e.message : "El recorrido está incompleto."}</p><p className="mt-3">No se cargará otro catálogo ni se ocultarán conceptos pendientes. Solicita a Dirección revisar la preparación.</p><Link href={`/panel/inspecciones/${id}`} className="mt-4 inline-block text-cyan-300">Volver al expediente</Link></main>;
  }
  if (!partidas) return null;
  const subs=partidas.flatMap(p=>p.subpartidas);
  const seleccion=subs.find(s=>s.area.id===query.area)??subs.find(s=>!s.cerrada)??subs[0];
  const partida=partidas.find(p=>p.subpartidas.includes(seleccion))!;
  const total=subs.reduce((n,s)=>n+s.items.length,0),resueltos=subs.reduce((n,s)=>n+s.resueltos,0);
  const completas=partidas.filter(p=>p.subpartidas.every(s=>s.cerrada)).length;
  const cerradas=subs.filter(s=>s.cerrada).length;
  const puntos=await prisma.$queryRaw<PuntoArea[]>`
    SELECT g."id",g."concepto",g."especificacion",${partida.nombre}::text AS "grupo",g."estadoV3",g."origenV3",g."obligatorio",g."herramientaSugerida",g."motivoNoAplica",g."observacion",g."requiereMedicion",g."requiereComparacionProyecto",g."valorMedido",g."valorProyecto",g."unidadMedida"
    FROM "GuiaInspeccionItem" g WHERE g."inspeccionId"=${id} AND g."areaId"=${seleccion.area.id}::uuid ORDER BY g."orden",g."creadoEn"
  `;
  const [detalle]=await prisma.$queryRaw<Array<{fotos:number;hallazgos:number}>>`
    SELECT (SELECT COUNT(*)::int FROM "FotografiaArea" WHERE "areaId"=${seleccion.area.id}::uuid) AS "fotos",
      (SELECT COUNT(*)::int FROM "Hallazgo" WHERE "inspeccionId"=${id} AND ("areaId"=${seleccion.area.id}::uuid OR "area"=${seleccion.nombre})) AS "hallazgos"
  `;
  const previos=subs.slice(0,subs.indexOf(seleccion)).reduce((n,s)=>n+s.items.length,0);
  const base=`/panel/inspecciones/${id}/campo-v1`;
  const disabled=seleccion.area.resultado==="NO_APLICA";
  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-7xl">
    <Link href={`/panel/inspecciones/${id}`} className="text-sm font-black text-cyan-300">← Expediente {folio}</Link>
    <p className="mt-5 text-xs font-black uppercase tracking-widest text-amber-300">Catálogo aprobado · plan confirmado</p>
    <h1 className="mt-2 text-3xl font-black">Desarrollo de partidas y conceptos</h1>
    <dl aria-label="Estadísticas del plan vigente" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {[
        {nombre:"Partidas",valor:partidas.length,detalle:`${completas} cerradas`},
        {nombre:"Subpartidas",valor:subs.length,detalle:`${cerradas} cerradas`},
        {nombre:"Conceptos",valor:total,detalle:`${resueltos} resueltos`},
        {nombre:"Conceptos pendientes",valor:total-resueltos,detalle:"Por resolver"},
        {nombre:"Avance de conceptos",valor:`${total?Math.round(resueltos/total*100):0}%`,detalle:`${resueltos} de ${total} resueltos`},
      ].map(({nombre,valor,detalle})=><div key={nombre} className="rounded-2xl border border-white/10 bg-slate-900 p-4"><dt className="text-sm text-slate-300">{nombre}</dt><dd className="mt-2 text-3xl font-black text-cyan-300">{valor}</dd><dd className="mt-1 text-xs text-slate-400">{detalle}</dd></div>)}
    </dl>
    <p className="mt-2 text-sm text-slate-400">El alcance corresponde a la vivienda cotizada. Los No aplica y las subpartidas deshabilitadas conservan su motivo; no se consideran pruebas realizadas.</p>
    {(query.ok||query.error)&&<p role="status" className={`mt-4 rounded-xl border p-4 ${query.error?"border-rose-300/30 text-rose-200":"border-emerald-300/30 text-emerald-200"}`}>{query.error??query.ok}</p>}
    <p className="mt-3 rounded-xl border border-amber-300/20 p-3 text-sm text-amber-200">Preparación sin conexión del nuevo catálogo pendiente de validación. Por ahora utiliza este recorrido con Internet; no descargues el recorrido anterior para este expediente.</p>
    <div className="mt-4"><RetomarRecorrido usuarioId={usuarioId} inspeccionId={id}/></div>
    <div className="mt-6 grid gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
      <nav aria-label="Partidas del plan confirmado" className="space-y-3">
        {partidas.map(p=><section key={p.orden} className="rounded-2xl border border-white/10 bg-slate-900 p-4">
          <h2 className="font-black text-amber-200">{p.orden}. {p.nombre}</h2>
          <p className="mt-1 text-xs text-slate-400">{p.subpartidas.every(s=>s.cerrada)?"CERRADA":"PENDIENTE"}</p>
          <div className="mt-3 space-y-2">{p.subpartidas.map(s=><Link key={s.area.id} href={`${base}?area=${s.area.id}`} aria-current={s===seleccion?"page":undefined} className={`block rounded-xl border px-3 py-3 text-sm ${s===seleccion?"border-cyan-300 bg-cyan-300/10":"border-white/10"}`}><strong>{s.nombre}</strong><span className="mt-1 block text-xs text-slate-400">{s.resueltos}/{s.items.length} conceptos · {s.area.resultado==="NO_APLICA"?"DESHABILITADA":s.cerrada?"CERRADA":"PENDIENTE"}</span></Link>)}</div>
        </section>)}
      </nav>
      <section className="min-w-0">
        <div className="rounded-2xl border border-cyan-300/20 bg-slate-900 p-5">
          <p className="text-xs font-black text-amber-200">PARTIDA {partida.orden} · {partida.nombre}</p><h2 className="mt-2 text-2xl font-black">{seleccion.nombre}</h2>
          <p className="mt-2 text-sm text-slate-300">{seleccion.items.length} conceptos · {detalle?.fotos??0} evidencias · {detalle?.hallazgos??0} hallazgos</p>
          {disabled&&<p className="mt-3 font-bold text-amber-200">Subpartida deshabilitada. Los antecedentes se conservan.</p>}
          {disabled&&puedeCapturar&&<form action={reactivarPartidaAreaV1} className="mt-4"><input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="areaId" value={seleccion.area.id}/><button className="rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950">REACTIVAR SUBPARTIDA</button></form>}
        </div>
        <div className="mt-5"><RecorridoConceptos key={seleccion.area.id} usuarioId={usuarioId} inspeccionId={id} partida={`${partida.nombre} · ${seleccion.nombre}`} ruta={`${base}?area=${seleccion.area.id}`} conceptos={puntos.map(({id, concepto, estadoV3})=>({id, concepto, estadoV3}))}>{puntos.map((p,i)=><ConceptoAreaCard key={p.id} inspeccionId={id} areaId={seleccion.area.id} punto={p} numeroConcepto={previos+i+1} puedeCapturar={puedeCapturar&&!disabled} areaActiva={true}/>)}</RecorridoConceptos></div>
        {puedeCapturar&&!disabled&&<div className="mt-5 space-y-4">
          <form action={agregarPuntoInspectorV1} className="grid gap-3 rounded-2xl border border-violet-300/20 p-4"><input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="areaId" value={seleccion.area.id}/><h3 className="font-black text-violet-200">Agregar concepto a esta subpartida</h3><input name="concepto" required placeholder="Concepto adicional" className="rounded-xl bg-slate-900 px-4 py-3"/><input name="especificacion" placeholder="Criterio a revisar" className="rounded-xl bg-slate-900 px-4 py-3"/><button className="rounded-xl border border-violet-300/40 px-4 py-3 font-bold">AGREGAR CONCEPTO</button></form>
          {!seleccion.cerrada&&<>
            <form action={deshabilitarPartidaAreaV1} className="grid gap-3 rounded-2xl border border-rose-300/20 p-4"><input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="areaId" value={seleccion.area.id}/><h3 className="font-black text-rose-200">Deshabilitar esta subpartida</h3><select name="causa" required className="rounded-xl bg-slate-900 px-4 py-3"><option value="">Selecciona la causa</option><option value="NO_APLICA">No aplica</option><option value="SIN_ACCESO">Sin acceso</option><option value="CONDICION_INSEGURA">Condición insegura</option><option value="OTRO">Otro motivo</option></select><input name="motivo" required minLength={3} placeholder="Motivo documentado" className="rounded-xl bg-slate-900 px-4 py-3"/><button className="rounded-xl border border-rose-300/40 px-4 py-3 font-bold">DESHABILITAR</button></form>
            <form action={detalle?.hallazgos?cerrarAreaConHallazgosV1:cerrarAreaSinHallazgosV1} className="rounded-2xl border border-emerald-300/20 p-4"><input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="areaId" value={seleccion.area.id}/><p className="text-sm text-slate-300">Revisa todos los conceptos y sus evidencias antes de cerrar. Una subpartida no revisada debe deshabilitarse con su motivo, no cerrarse como inspeccionada.</p><button disabled={seleccion.resueltos!==seleccion.items.length || (!detalle?.hallazgos&&!detalle?.fotos)} className="mt-4 w-full rounded-xl bg-emerald-300 px-4 py-3 font-black text-slate-950 disabled:opacity-30">CERRAR SUBPARTIDA {detalle?.hallazgos?"CON HALLAZGOS":"SIN HALLAZGOS"}</button></form>
          </>}
        </div>}
      </section>
    </div>
    {puedeCapturar&&<form action={concluirInspeccionTecnicaV1} className="mt-8 rounded-2xl border border-cyan-300/20 p-5"><input type="hidden" name="inspeccionId" value={id}/><input type="hidden" name="retorno" value="campo"/><p>Para concluir deben estar cerradas todas las subpartidas y resueltos todos los conceptos del plan. Se comprobarán portada, hallazgos y sincronizaciones pendientes.</p><button disabled={cerradas!==subs.length || total!==resueltos} className="mt-4 rounded-xl bg-cyan-300 px-5 py-3 font-black text-slate-950 disabled:opacity-30">CONCLUIR INSPECCIÓN TÉCNICA</button></form>}
  </div></main>;
}
