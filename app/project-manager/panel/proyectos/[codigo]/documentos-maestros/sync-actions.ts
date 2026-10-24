"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();
const json=(v:unknown)=>JSON.parse(JSON.stringify(v??null)) as Prisma.InputJsonValue;

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

export async function sincronizarDocumentosConModulos(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);

  const docs=await prisma.documentoMaestroPM.findMany({
    where:{proyectoId:proyecto.id,activo:true},
    include:{actividades:true}
  });

  let registros=0;
  let seguimientos=0;

  for(const doc of docs){
    for(const a of doc.actividades){
      const modulos=Array.isArray(a.modulosDestino)?a.modulosDestino.map(String):
        (Array.isArray(doc.modulosDestino)?doc.modulosDestino.map(String):[]);
      const mods=[...new Set(modulos.filter(Boolean))];

      for(const modulo of mods){
        await prisma.registroModuloPM.upsert({
          where:{actividadOrigenId_modulo:{actividadOrigenId:a.id,modulo}},
          create:{
            proyectoId:proyecto.id,
            actividadOrigenId:a.id,
            modulo,
            clave:a.codigo,
            titulo:a.actividad,
            descripcion:a.descripcion,
            estado:a.estado,
            responsable:a.responsable,
            fechaPlan:a.fechaFinPlan ?? a.fechaInicioPlan,
            fechaReal:a.fechaFinReal ?? a.fechaInicioReal,
            importePlan:a.costoPresupuestado,
            importeReal:a.costoReal,
            bloqueante:a.bloqueante,
            entregable:a.entregable,
            fuenteDocumento:doc.codigo,
            datos:json({
              tipo:a.tipo,
              etapa:a.etapa,
              dependencia:a.dependencia,
              organismo:a.organismo,
              periodicidad:a.periodicidad,
              reglaAlerta:a.reglaAlerta,
              origen:a.origen
            })
          },
          update:{
            clave:a.codigo,
            titulo:a.actividad,
            descripcion:a.descripcion,
            estado:a.estado,
            responsable:a.responsable,
            fechaPlan:a.fechaFinPlan ?? a.fechaInicioPlan,
            fechaReal:a.fechaFinReal ?? a.fechaInicioReal,
            importePlan:a.costoPresupuestado,
            importeReal:a.costoReal,
            bloqueante:a.bloqueante,
            entregable:a.entregable,
            fuenteDocumento:doc.codigo,
            datos:json({
              tipo:a.tipo,
              etapa:a.etapa,
              dependencia:a.dependencia,
              organismo:a.organismo,
              periodicidad:a.periodicidad,
              reglaAlerta:a.reglaAlerta,
              origen:a.origen
            })
          }
        });
        registros++;
      }

      const periodicidad=(a.periodicidad||doc.periodicidadDefault||"POR_EVENTO").toUpperCase();
      const base=a.fechaInicioPlan ?? proyecto.fechaInicio ?? new Date();
      const proxima=nextReview(periodicidad,base);

      await prisma.seguimientoActividadPM.upsert({
        where:{actividadOrigenId:a.id},
        create:{
          proyectoId:proyecto.id,
          actividadOrigenId:a.id,
          periodicidad,
          responsable:a.responsable,
          proximaRevision:proxima,
          estado:a.estado,
          requiereActualizacion:a.estado!=="COMPLETO"
        },
        update:{
          periodicidad,
          responsable:a.responsable,
          proximaRevision:proxima,
          estado:a.estado,
          requiereActualizacion:a.estado!=="COMPLETO"
        }
      });
      seguimientos++;
    }
  }

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/documentos-maestros`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/seguimiento`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/modulos`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/documentos-maestros?sincronizados=${registros}&seguimientos=${seguimientos}`);
}
