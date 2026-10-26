"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const MOD_EVAL="DIRECCION_EVALUACION";
const MOD_DEC="DIRECCION_DECISION";
const MOD_RISK="DIRECCION_RIESGO";

function textValue(fd:FormData,key:string){
  return String(fd.get(key) ?? "").trim();
}
function numberValue(fd:FormData,key:string){
  const raw=textValue(fd,key);
  if(!raw) return 0;
  const n=Number(raw);
  return Number.isFinite(n)?n:0;
}
function dateValue(fd:FormData,key:string){
  const raw=textValue(fd,key);
  return raw ? new Date(raw+"T12:00:00.000Z") : null;
}
function score(value:string){
  const n=Number(value);
  if(!Number.isFinite(n)) return 0;
  return Math.max(0,Math.min(100,Math.round(n)));
}

async function ensureMaster(proyectoId:string){
  return prisma.documentoMaestroPM.upsert({
    where:{proyectoId_codigo:{proyectoId,codigo:"DD-GESTION"}},
    create:{
      proyectoId,
      codigo:"DD-GESTION",
      nombre:"Dirección y Desarrollo",
      descripcion:"Expediente operativo de evaluación técnico-económica, decisiones directivas y riesgos del proyecto.",
      tipo:"DIRECCION_DESARROLLO",
      obligatorio:true,
      activo:true,
      estado:"ACTIVO",
      origen:"CERTEZA_TECNICA_360",
      moduloPrincipal:"DIRECCION_DESARROLLO",
      modulosDestino:["DIRECCION","REPORTES","INTELIGENCIA","EXPEDIENTE_MAESTRO"],
    },
    update:{
      activo:true,
      estado:"ACTIVO",
      moduloPrincipal:"DIRECCION_DESARROLLO",
    },
  });
}

async function ensureEvaluationActivity(proyectoId:string){
  const master=await ensureMaster(proyectoId);
  return prisma.actividadDocumentoMaestroPM.upsert({
    where:{documentoMaestroId_codigo:{documentoMaestroId:master.id,codigo:"DD-EVAL-001"}},
    create:{
      documentoMaestroId:master.id,
      codigo:"DD-EVAL-001",
      actividad:"Evaluación técnico-económica integral",
      descripcion:"Evaluación directiva de viabilidad técnica, económica, documental y operativa.",
      tipo:"EVALUACION",
      etapa:"DIRECCION_Y_DESARROLLO",
      prioridad:"ALTA",
      estado:"EN_PROCESO",
      entregable:"Dictamen de evaluación técnico-económica",
      modulosDestino:["DIRECCION","REPORTES","INTELIGENCIA"],
      origen:"CERTEZA_TECNICA_360",
    },
    update:{
      actividad:"Evaluación técnico-económica integral",
      estado:"EN_PROCESO",
    },
  });
}

export async function guardarEvaluacionDireccion(fd:FormData){
  const codigo=textValue(fd,"codigo").toUpperCase();
  const access=await requireProjectWriteAccess(codigo);
  const actividad=await ensureEvaluationActivity(access.proyecto.id);

  const tecnica=score(textValue(fd,"viabilidadTecnica"));
  const economica=score(textValue(fd,"viabilidadEconomica"));
  const documental=score(textValue(fd,"viabilidadDocumental"));
  const operativa=score(textValue(fd,"viabilidadOperativa"));
  const promedio=Math.round((tecnica+economica+documental+operativa)/4);
  const estado=promedio>=80?"FAVORABLE":promedio>=60?"FAVORABLE_CON_OBSERVACIONES":"REQUIERE_DECISION";

  await prisma.registroModuloPM.upsert({
    where:{actividadOrigenId_modulo:{actividadOrigenId:actividad.id,modulo:MOD_EVAL}},
    create:{
      proyectoId:access.proyecto.id,
      actividadOrigenId:actividad.id,
      modulo:MOD_EVAL,
      clave:"EVAL-001",
      titulo:"Evaluación técnico-económica",
      descripcion:textValue(fd,"conclusion") || "Evaluación integral del proyecto.",
      estado,
      responsable:textValue(fd,"responsable") || null,
      datos:{
        viabilidadTecnica:tecnica,
        viabilidadEconomica:economica,
        viabilidadDocumental:documental,
        viabilidadOperativa:operativa,
        calificacionGlobal:promedio,
        recomendacion:textValue(fd,"recomendacion"),
        supuestos:textValue(fd,"supuestos"),
        observaciones:textValue(fd,"observaciones"),
      },
    },
    update:{
      descripcion:textValue(fd,"conclusion") || "Evaluación integral del proyecto.",
      estado,
      responsable:textValue(fd,"responsable") || null,
      datos:{
        viabilidadTecnica:tecnica,
        viabilidadEconomica:economica,
        viabilidadDocumental:documental,
        viabilidadOperativa:operativa,
        calificacionGlobal:promedio,
        recomendacion:textValue(fd,"recomendacion"),
        supuestos:textValue(fd,"supuestos"),
        observaciones:textValue(fd,"observaciones"),
      },
    },
  });

  await prisma.actividadDocumentoMaestroPM.update({
    where:{id:actividad.id},
    data:{estado:"COMPLETADA"},
  });

  revalidatePath(`/certeza-tecnica/app/direccion-desarrollo/${codigo.toLowerCase()}`);
}

export async function agregarDecisionDireccion(fd:FormData){
  const codigo=textValue(fd,"codigo").toUpperCase();
  const access=await requireProjectWriteAccess(codigo);
  const master=await ensureMaster(access.proyecto.id);
  const stamp=Date.now().toString(36).toUpperCase();
  const actividad=await prisma.actividadDocumentoMaestroPM.create({
    data:{
      documentoMaestroId:master.id,
      codigo:`DD-DEC-${stamp}`,
      actividad:textValue(fd,"titulo") || "Decisión directiva",
      descripcion:textValue(fd,"descripcion") || null,
      tipo:"DECISION",
      etapa:"DIRECCION_Y_DESARROLLO",
      responsable:textValue(fd,"responsable") || null,
      fechaFinPlan:dateValue(fd,"fechaLimite"),
      prioridad:textValue(fd,"prioridad") || "MEDIA",
      estado:"PENDIENTE",
      bloqueante:textValue(fd,"bloqueante")==="SI",
      entregable:"Decisión registrada y cerrada",
      modulosDestino:["DIRECCION","PROJECT_MANAGER","REPORTES","INTELIGENCIA"],
      origen:"CERTEZA_TECNICA_360",
    },
  });

  await prisma.registroModuloPM.create({
    data:{
      proyectoId:access.proyecto.id,
      actividadOrigenId:actividad.id,
      modulo:MOD_DEC,
      clave:`DEC-${stamp}`,
      titulo:textValue(fd,"titulo") || "Decisión directiva",
      descripcion:textValue(fd,"descripcion") || null,
      estado:"PENDIENTE",
      responsable:textValue(fd,"responsable") || null,
      fechaPlan:dateValue(fd,"fechaLimite"),
      importePlan:numberValue(fd,"impactoCosto"),
      bloqueante:textValue(fd,"bloqueante")==="SI",
      datos:{
        prioridad:textValue(fd,"prioridad") || "MEDIA",
        impactoPlazoDias:numberValue(fd,"impactoPlazoDias"),
        alternativaRecomendada:textValue(fd,"alternativaRecomendada"),
        justificacion:textValue(fd,"justificacion"),
      },
    },
  });

  revalidatePath(`/certeza-tecnica/app/direccion-desarrollo/${codigo.toLowerCase()}`);
}

export async function agregarRiesgoDireccion(fd:FormData){
  const codigo=textValue(fd,"codigo").toUpperCase();
  const access=await requireProjectWriteAccess(codigo);
  const master=await ensureMaster(access.proyecto.id);
  const stamp=Date.now().toString(36).toUpperCase();
  const prob=Math.max(1,Math.min(5,numberValue(fd,"probabilidad") || 1));
  const imp=Math.max(1,Math.min(5,numberValue(fd,"impacto") || 1));
  const nivel=prob*imp;
  const semaforo=nivel>=16?"ROJO":nivel>=8?"AMARILLO":"VERDE";

  const actividad=await prisma.actividadDocumentoMaestroPM.create({
    data:{
      documentoMaestroId:master.id,
      codigo:`DD-RSK-${stamp}`,
      actividad:textValue(fd,"titulo") || "Riesgo directivo",
      descripcion:textValue(fd,"descripcion") || null,
      tipo:"RIESGO",
      etapa:"DIRECCION_Y_DESARROLLO",
      responsable:textValue(fd,"responsable") || null,
      fechaFinPlan:dateValue(fd,"fechaRevision"),
      prioridad:semaforo==="ROJO"?"CRITICA":semaforo==="AMARILLO"?"ALTA":"MEDIA",
      estado:"ABIERTO",
      bloqueante:semaforo==="ROJO",
      entregable:"Respuesta de riesgo ejecutada",
      modulosDestino:["DIRECCION","PROJECT_MANAGER","REPORTES","INTELIGENCIA"],
      origen:"CERTEZA_TECNICA_360",
    },
  });

  await prisma.registroModuloPM.create({
    data:{
      proyectoId:access.proyecto.id,
      actividadOrigenId:actividad.id,
      modulo:MOD_RISK,
      clave:`RSK-${stamp}`,
      titulo:textValue(fd,"titulo") || "Riesgo directivo",
      descripcion:textValue(fd,"descripcion") || null,
      estado:"ABIERTO",
      responsable:textValue(fd,"responsable") || null,
      fechaPlan:dateValue(fd,"fechaRevision"),
      importePlan:numberValue(fd,"exposicionCosto"),
      bloqueante:semaforo==="ROJO",
      datos:{
        probabilidad:prob,
        impacto:imp,
        nivel,
        semaforo,
        respuesta:textValue(fd,"respuesta"),
        disparador:textValue(fd,"disparador"),
        impactoPlazoDias:numberValue(fd,"impactoPlazoDias"),
      },
    },
  });

  revalidatePath(`/certeza-tecnica/app/direccion-desarrollo/${codigo.toLowerCase()}`);
}

export async function actualizarEstadoDireccion(fd:FormData){
  const codigo=textValue(fd,"codigo").toUpperCase();
  const registroId=textValue(fd,"registroId");
  const estado=textValue(fd,"estado");
  const access=await requireProjectWriteAccess(codigo);

  const registro=await prisma.registroModuloPM.findFirst({
    where:{id:registroId,proyectoId:access.proyecto.id,modulo:{in:[MOD_DEC,MOD_RISK]}},
    select:{id:true,actividadOrigenId:true},
  });
  if(!registro) return;

  await prisma.$transaction([
    prisma.registroModuloPM.update({where:{id:registro.id},data:{estado,fechaReal:estado==="CERRADA"||estado==="MITIGADO"?new Date():null}}),
    prisma.actividadDocumentoMaestroPM.update({where:{id:registro.actividadOrigenId},data:{estado:estado==="CERRADA"||estado==="MITIGADO"?"COMPLETADA":estado}}),
  ]);

  revalidatePath(`/certeza-tecnica/app/direccion-desarrollo/${codigo.toLowerCase()}`);
}
