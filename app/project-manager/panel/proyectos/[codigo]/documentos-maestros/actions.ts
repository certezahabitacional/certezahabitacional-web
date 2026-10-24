"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";
import { buildMasterDocumentDefinitions, actividadesBaseDM01 } from "@/lib/project-manager/master-document-definitions";
import { buildMasterDocumentActivities } from "@/lib/project-manager/master-document-activities";
import { buildRecalculationPreview } from "@/lib/project-manager/master-document-recalculation";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();
const json=(v:unknown)=>JSON.parse(JSON.stringify(v??null)) as Prisma.InputJsonValue;

export async function generarDocumentosMaestros(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);
  const c=await prisma.constructibilidadPM.findUnique({where:{proyectoId:proyecto.id}});
  if(!c) redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad?error=sin_constructibilidad`);

  const docs=buildMasterDocumentDefinitions(c);
  for(const d of docs){
    const doc=await prisma.documentoMaestroPM.upsert({
      where:{proyectoId_codigo:{proyectoId:proyecto.id,codigo:d.codigo}},
      create:{
        proyectoId:proyecto.id,codigo:d.codigo,nombre:d.nombre,descripcion:d.descripcion,tipo:d.tipo,
        obligatorio:d.obligatorio,moduloPrincipal:d.moduloPrincipal,modulosDestino:json(d.modulosDestino),
        periodicidadDefault:d.periodicidadDefault,reglasConfiguracion:json({generadoDesde:"Constructibilidad"})
      },
      update:{
        nombre:d.nombre,descripcion:d.descripcion,tipo:d.tipo,obligatorio:d.obligatorio,activo:true,
        moduloPrincipal:d.moduloPrincipal,modulosDestino:json(d.modulosDestino),
        periodicidadDefault:d.periodicidadDefault,reglasConfiguracion:json({generadoDesde:"Constructibilidad"})
      }
    });

    const automaticas=d.codigo==="DM-01"
      ? actividadesBaseDM01().map(([codigoAct,actividad,tipo,etapa,dependencia,entregable,periodicidad,bloqueante])=>({
          codigo:String(codigoAct),actividad:String(actividad),descripcion:undefined,tipo:String(tipo),etapa:String(etapa),
          dependencia:String(dependencia),responsable:undefined,organismo:undefined,fechaInicioPlan:undefined,fechaFinPlan:undefined,
          entregable:String(entregable),periodicidad:String(periodicidad),bloqueante:Boolean(bloqueante),prioridad:"MEDIA" as const,
          modulosDestino:["Programa","Documentación","Riesgos","Liberaciones","Costos"],reglaAlerta:undefined
        }))
      : buildMasterDocumentActivities(c,d.codigo);

    for(const a of automaticas){
      await prisma.actividadDocumentoMaestroPM.upsert({
        where:{documentoMaestroId_codigo:{documentoMaestroId:doc.id,codigo:a.codigo}},
        create:{
          documentoMaestroId:doc.id,codigo:a.codigo,actividad:a.actividad,descripcion:a.descripcion??null,tipo:a.tipo,
          etapa:a.etapa,dependencia:a.dependencia??null,responsable:a.responsable??null,organismo:a.organismo??null,
          fechaInicioPlan:a.fechaInicioPlan?new Date(a.fechaInicioPlan):null,
          fechaFinPlan:a.fechaFinPlan?new Date(a.fechaFinPlan):null,
          entregable:a.entregable,periodicidad:a.periodicidad,bloqueante:a.bloqueante,prioridad:a.prioridad,
          modulosDestino:json(a.modulosDestino),reglaAlerta:a.reglaAlerta??null,origen:"AUTOMATICO"
        },
        update:{
          actividad:a.actividad,descripcion:a.descripcion??null,tipo:a.tipo,etapa:a.etapa,dependencia:a.dependencia??null,
          responsable:a.responsable??undefined,organismo:a.organismo??undefined,
          fechaInicioPlan:a.fechaInicioPlan?new Date(a.fechaInicioPlan):undefined,
          fechaFinPlan:a.fechaFinPlan?new Date(a.fechaFinPlan):undefined,
          entregable:a.entregable,periodicidad:a.periodicidad,bloqueante:a.bloqueante,prioridad:a.prioridad,
          modulosDestino:json(a.modulosDestino),reglaAlerta:a.reglaAlerta??null
        }
      });
    }

    const codigosVigentes=automaticas.map(a=>a.codigo);
    const baseLimpieza={
      documentoMaestroId:doc.id,
      origen:"AUTOMATICO",
      estado:"PENDIENTE",
      fechaInicioReal:null,
      fechaFinReal:null,
      evidenciaUrl:null,
      costoReal:0,
      notas:null
    };
    if(codigosVigentes.length){
      await prisma.actividadDocumentoMaestroPM.deleteMany({
        where:{...baseLimpieza,codigo:{notIn:codigosVigentes}}
      });
    }else{
      await prisma.actividadDocumentoMaestroPM.deleteMany({where:baseLimpieza});
    }
  }

  await prisma.documentoMaestroPM.updateMany({
    where:{proyectoId:proyecto.id,codigo:{notIn:docs.map(d=>d.codigo)}},
    data:{activo:false}
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/documentos-maestros`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/documentos-maestros?generados=1`);
}

export async function agregarActividadManual(formData:FormData){
  const codigoProyecto=clean(formData.get("codigoProyecto")).toUpperCase();
  const documentoId=clean(formData.get("documentoId"));
  if(!codigoProyecto||!documentoId) return;
  const {proyecto}=await requireProjectWriteAccess(codigoProyecto);

  const doc=await prisma.documentoMaestroPM.findFirst({where:{id:documentoId,proyectoId:proyecto.id}});
  if(!doc) return;

  const count=await prisma.actividadDocumentoMaestroPM.count({where:{documentoMaestroId:doc.id}});
  const prefix=doc.codigo.replace("DM-","");
  const codigoAct=clean(formData.get("codigoActividad")) || `${prefix}-M${String(count+1).padStart(3,"0")}`;

  await prisma.actividadDocumentoMaestroPM.create({
    data:{
      documentoMaestroId:doc.id,
      codigo:codigoAct,
      actividad:clean(formData.get("actividad"))||"Actividad manual",
      descripcion:clean(formData.get("descripcion"))||null,
      tipo:clean(formData.get("tipo"))||"ACTIVIDAD",
      responsable:clean(formData.get("responsable"))||null,
      organismo:clean(formData.get("organismo"))||null,
      fechaInicioPlan:clean(formData.get("fechaInicioPlan"))?new Date(clean(formData.get("fechaInicioPlan"))):null,
      fechaFinPlan:clean(formData.get("fechaFinPlan"))?new Date(clean(formData.get("fechaFinPlan"))):null,
      estado:"PENDIENTE",
      prioridad:clean(formData.get("prioridad"))||"MEDIA",
      entregable:clean(formData.get("entregable"))||null,
      bloqueante:formData.get("bloqueante")==="on",
      periodicidad:clean(formData.get("periodicidad"))||doc.periodicidadDefault,
      reglaAlerta:clean(formData.get("reglaAlerta"))||null,
      modulosDestino:doc.modulosDestino??undefined,
      origen:"MANUAL"
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigoProyecto.toLowerCase()}/documentos-maestros/${doc.codigo.toLowerCase()}`);
  redirect(`/project-manager/panel/proyectos/${codigoProyecto.toLowerCase()}/documentos-maestros/${doc.codigo.toLowerCase()}?agregada=1`);
}
