"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();

function clampPct(v:string){
  const n=Number(v);
  if(!Number.isFinite(n)) return null;
  return Math.max(0,Math.min(100,n));
}

function nextReview(periodicidad:string,base:Date){
  const d=new Date(base);
  const p=periodicidad.toUpperCase();
  if(p==="DIARIA") d.setDate(d.getDate()+1);
  else if(p==="SEMANAL") d.setDate(d.getDate()+7);
  else if(p==="QUINCENAL") d.setDate(d.getDate()+15);
  else if(p==="MENSUAL") d.setMonth(d.getMonth()+1);
  else return null;
  return d;
}

export async function registrarSeguimientoUnico(formData:FormData){
  const codigoProyecto=clean(formData.get("codigoProyecto")).toUpperCase();
  const seguimientoId=clean(formData.get("seguimientoId"));
  if(!codigoProyecto||!seguimientoId) return;

  const {proyecto}=await requireProjectWriteAccess(codigoProyecto);
  const seguimiento=await prisma.seguimientoActividadPM.findFirst({
    where:{id:seguimientoId,proyectoId:proyecto.id},
    include:{actividadOrigen:true}
  });
  if(!seguimiento) return;

  const estado=clean(formData.get("estado"))||seguimiento.estado||"PENDIENTE";
  const avance=clampPct(clean(formData.get("porcentajeAvance")));
  const comentario=clean(formData.get("comentario"))||null;
  const evidenciaUrl=clean(formData.get("evidenciaUrl"))||null;
  const valorActual=clean(formData.get("valorActual"))||null;
  const fechaRealTexto=clean(formData.get("fechaReal"));
  const fechaReal=fechaRealTexto?new Date(fechaRealTexto):null;
  const ahora=new Date();
  const completo=estado==="COMPLETO" || avance===100;
  const estadoFinal=completo?"COMPLETO":estado;
  const proximaRevision=completo?null:nextReview(seguimiento.periodicidad,ahora);

  await prisma.$transaction(async tx=>{
    await tx.seguimientoActividadPM.update({
      where:{id:seguimiento.id},
      data:{
        estado:estadoFinal,
        ultimaRevision:ahora,
        proximaRevision,
        requiereActualizacion:!completo,
        valorActual,
        porcentajeAvance:avance,
        comentario,
        evidenciaUrl
      }
    });

    await tx.actividadDocumentoMaestroPM.update({
      where:{id:seguimiento.actividadOrigenId},
      data:{
        estado:estadoFinal,
        fechaInicioReal:seguimiento.actividadOrigen.fechaInicioReal ?? (avance!=null&&avance>0?ahora:null),
        fechaFinReal:completo?(fechaReal??ahora):(fechaReal??seguimiento.actividadOrigen.fechaFinReal),
        evidenciaUrl:evidenciaUrl??seguimiento.actividadOrigen.evidenciaUrl,
        notas:comentario??seguimiento.actividadOrigen.notas
      }
    });

    await tx.registroModuloPM.updateMany({
      where:{proyectoId:proyecto.id,actividadOrigenId:seguimiento.actividadOrigenId},
      data:{
        estado:estadoFinal,
        fechaReal:completo?(fechaReal??ahora):fechaReal,
        datos:{
          avancePorcentaje:avance,
          valorActual,
          comentario,
          evidenciaUrl,
          actualizadoDesde:"SEGUIMIENTO_UNICO",
          actualizadoEn:ahora.toISOString()
        }
      }
    });
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigoProyecto.toLowerCase()}/seguimiento`);
  revalidatePath(`/project-manager/panel/proyectos/${codigoProyecto.toLowerCase()}/modulos`);
  revalidatePath(`/project-manager/panel/proyectos/${codigoProyecto.toLowerCase()}/documentos-maestros`);
  redirect(`/project-manager/panel/proyectos/${codigoProyecto.toLowerCase()}/seguimiento?actualizado=1`);
}
