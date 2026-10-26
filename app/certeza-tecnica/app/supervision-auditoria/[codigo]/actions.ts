"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const MOD_HALL="SUPERVISION_HALLAZGO";
const MOD_QUAL="SUPERVISION_CALIDAD";
const MOD_EST="AUDITORIA_ESTIMACION";
const MOD_COST="AUDITORIA_COSTOS";
const MOD_CON="AUDITORIA_CONTRACTUAL";
const MOD_CLOSE="AUDITORIA_CIERRE";

function txt(fd:FormData,key:string){return String(fd.get(key)??"").trim();}
function num(fd:FormData,key:string){const n=Number(txt(fd,key)); return Number.isFinite(n)?n:0;}
function dt(fd:FormData,key:string){const v=txt(fd,key); return v?new Date(v+"T12:00:00.000Z"):null;}

async function ensureMaster(proyectoId:string){
  return prisma.documentoMaestroPM.upsert({
    where:{proyectoId_codigo:{proyectoId,codigo:"SA-GESTION"}},
    create:{
      proyectoId,
      codigo:"SA-GESTION",
      nombre:"Supervisión y Auditoría",
      descripcion:"Expediente operativo de supervisión técnica, calidad, auditorías y cierre.",
      tipo:"SUPERVISION_AUDITORIA",
      obligatorio:true,
      activo:true,
      estado:"ACTIVO",
      origen:"CERTEZA_TECNICA_360",
      moduloPrincipal:"SUPERVISION_AUDITORIA",
      modulosDestino:["SUPERVISION","AUDITORIA","REPORTES","INTELIGENCIA","EXPEDIENTE_MAESTRO"],
    },
    update:{activo:true,estado:"ACTIVO",moduloPrincipal:"SUPERVISION_AUDITORIA"},
  });
}

async function createActivity(proyectoId:string,params:{
  codigo:string;actividad:string;descripcion?:string;tipo:string;responsable?:string;fecha?:Date|null;prioridad?:string;bloqueante?:boolean;
}){
  const master=await ensureMaster(proyectoId);
  return prisma.actividadDocumentoMaestroPM.create({
    data:{
      documentoMaestroId:master.id,
      codigo:params.codigo,
      actividad:params.actividad,
      descripcion:params.descripcion||null,
      tipo:params.tipo,
      etapa:"SUPERVISION_Y_AUDITORIA",
      responsable:params.responsable||null,
      fechaFinPlan:params.fecha||null,
      prioridad:params.prioridad||"MEDIA",
      estado:"ABIERTO",
      bloqueante:params.bloqueante||false,
      entregable:"Registro cerrado con evidencia",
      modulosDestino:["SUPERVISION","AUDITORIA","PROJECT_MANAGER","REPORTES","INTELIGENCIA"],
      origen:"CERTEZA_TECNICA_360",
    },
  });
}

export async function agregarHallazgo(fd:FormData){
  const codigo=txt(fd,"codigo").toUpperCase();
  const access=await requireProjectWriteAccess(codigo);
  const stamp=Date.now().toString(36).toUpperCase();
  const criticidad=txt(fd,"criticidad")||"MEDIA";
  const bloqueante=criticidad==="CRITICA";
  const act=await createActivity(access.proyecto.id,{
    codigo:`SA-HAL-${stamp}`,
    actividad:txt(fd,"titulo")||"Hallazgo de supervisión",
    descripcion:txt(fd,"descripcion"),
    tipo:"HALLAZGO",
    responsable:txt(fd,"responsable"),
    fecha:dt(fd,"fechaCompromiso"),
    prioridad:criticidad,
    bloqueante,
  });
  await prisma.registroModuloPM.create({
    data:{
      proyectoId:access.proyecto.id,
      actividadOrigenId:act.id,
      modulo:MOD_HALL,
      clave:`HAL-${stamp}`,
      titulo:txt(fd,"titulo")||"Hallazgo de supervisión",
      descripcion:txt(fd,"descripcion")||null,
      estado:"ABIERTO",
      responsable:txt(fd,"responsable")||null,
      fechaPlan:dt(fd,"fechaCompromiso"),
      importePlan:num(fd,"costoEstimado"),
      bloqueante,
      fuenteDocumento:txt(fd,"evidenciaUrl")||null,
      datos:{
        criticidad,
        area:txt(fd,"area"),
        ubicacion:txt(fd,"ubicacion"),
        normaEspecificacion:txt(fd,"normaEspecificacion"),
        recomendacion:txt(fd,"recomendacion"),
        impactoPlazoDias:num(fd,"impactoPlazoDias"),
      },
    },
  });
  revalidatePath(`/certeza-tecnica/app/supervision-auditoria/${codigo.toLowerCase()}`);
}

export async function agregarRegistroAuditoria(fd:FormData){
  const codigo=txt(fd,"codigo").toUpperCase();
  const access=await requireProjectWriteAccess(codigo);
  const tipo=txt(fd,"tipo");
  const map:Record<string,{modulo:string,prefix:string,label:string}>={
    CALIDAD:{modulo:MOD_QUAL,prefix:"CAL",label:"Registro de calidad"},
    ESTIMACION:{modulo:MOD_EST,prefix:"EST",label:"Auditoría de estimación"},
    COSTOS:{modulo:MOD_COST,prefix:"COS",label:"Auditoría de costos"},
    CONTRACTUAL:{modulo:MOD_CON,prefix:"CON",label:"Auditoría contractual"},
    CIERRE:{modulo:MOD_CLOSE,prefix:"CIE",label:"Cierre y recepción"},
  };
  const cfg=map[tipo]??map.CALIDAD;
  const stamp=Date.now().toString(36).toUpperCase();
  const act=await createActivity(access.proyecto.id,{
    codigo:`SA-${cfg.prefix}-${stamp}`,
    actividad:txt(fd,"titulo")||cfg.label,
    descripcion:txt(fd,"descripcion"),
    tipo,
    responsable:txt(fd,"responsable"),
    fecha:dt(fd,"fechaRevision"),
    prioridad:txt(fd,"prioridad")||"MEDIA",
    bloqueante:txt(fd,"bloqueante")==="SI",
  });
  await prisma.registroModuloPM.create({
    data:{
      proyectoId:access.proyecto.id,
      actividadOrigenId:act.id,
      modulo:cfg.modulo,
      clave:`${cfg.prefix}-${stamp}`,
      titulo:txt(fd,"titulo")||cfg.label,
      descripcion:txt(fd,"descripcion")||null,
      estado:"ABIERTO",
      responsable:txt(fd,"responsable")||null,
      fechaPlan:dt(fd,"fechaRevision"),
      importePlan:num(fd,"importePlan"),
      importeReal:num(fd,"importeReal"),
      bloqueante:txt(fd,"bloqueante")==="SI",
      fuenteDocumento:txt(fd,"fuenteDocumento")||null,
      datos:{
        tipo,
        prioridad:txt(fd,"prioridad")||"MEDIA",
        referencia:txt(fd,"referencia"),
        criterio:txt(fd,"criterio"),
        resultado:txt(fd,"resultado"),
        desviacion:num(fd,"desviacion"),
        avanceFisico:num(fd,"avanceFisico"),
        avanceFinanciero:num(fd,"avanceFinanciero"),
        recomendacion:txt(fd,"recomendacion"),
      },
    },
  });
  revalidatePath(`/certeza-tecnica/app/supervision-auditoria/${codigo.toLowerCase()}`);
}

export async function cerrarRegistroSupervision(fd:FormData){
  const codigo=txt(fd,"codigo").toUpperCase();
  const id=txt(fd,"registroId");
  const access=await requireProjectWriteAccess(codigo);
  const r=await prisma.registroModuloPM.findFirst({
    where:{id,proyectoId:access.proyecto.id,modulo:{in:[MOD_HALL,MOD_QUAL,MOD_EST,MOD_COST,MOD_CON,MOD_CLOSE]}},
    select:{id:true,actividadOrigenId:true},
  });
  if(!r) return;
  await prisma.$transaction([
    prisma.registroModuloPM.update({where:{id:r.id},data:{estado:"CERRADO",fechaReal:new Date()}}),
    prisma.actividadDocumentoMaestroPM.update({where:{id:r.actividadOrigenId},data:{estado:"COMPLETADA"}}),
  ]);
  revalidatePath(`/certeza-tecnica/app/supervision-auditoria/${codigo.toLowerCase()}`);
}
