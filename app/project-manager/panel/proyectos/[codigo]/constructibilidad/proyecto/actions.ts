"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();

const DISCIPLINES=["arquitectura","estructura","hidrosanitaria","electrica","gas","pluvial","telecom","hvac","pci","urbanizacion","paisajismo","especialidades"] as const;
const PERMITS=["usoSuelo","fraccionamiento","licenciaConstruccion","numeroOficial","alineamiento","agua","energia","ambiental","proteccionCivil","vialidades","bomberos","otros"] as const;

function item(fd:FormData,key:string){
  return {
    estado:clean(fd.get(`${key}Estado`)),
    responsable:clean(fd.get(`${key}Responsable`)),
    fecha:clean(fd.get(`${key}Fecha`)),
    observaciones:clean(fd.get(`${key}Observaciones`)),
  };
}

export async function guardarProyectoAutorizaciones(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);

  const proyectoEjecutivo=Object.fromEntries(DISCIPLINES.map(k=>[k,item(formData,k)]));
  const autorizacionesConstruccion=Object.fromEntries(PERMITS.map(k=>[k,item(formData,k)]));

  const risks:string[]=[];
  const entregables:string[]=["Matriz de avance de proyecto ejecutivo","Matriz de autorizaciones y permisos","Condición de liberación para construir"];
  const countStatus=(obj:Record<string,any>,valid:string[])=>Object.values(obj).filter((x:any)=>valid.includes(x.estado)).length;

  for(const [k,v] of Object.entries(proyectoEjecutivo as Record<string,any>)){
    if(!v.estado || v.estado==="PENDIENTE" || v.estado==="OBSERVADO") risks.push(`Proyecto ${k}: ${v.estado||"sin definir"}`);
  }
  for(const [k,v] of Object.entries(autorizacionesConstruccion as Record<string,any>)){
    if(v.estado==="REQUERIDO" || v.estado==="EN_TRAMITE" || v.estado==="OBSERVADO" || !v.estado) risks.push(`Autorización ${k}: ${v.estado||"sin definir"}`);
  }

  const projectDone=countStatus(proyectoEjecutivo as Record<string,any>,["APROBADO_PARA_CONSTRUCCION","TERMINADO"]);
  const permitDone=countStatus(autorizacionesConstruccion as Record<string,any>,["APROBADO","NO_APLICA"]);
  const total=DISCIPLINES.length+PERMITS.length;
  const avance=Math.round(((projectDone+permitDone)/total)*100);

  const current=await prisma.constructibilidadPM.findUnique({where:{proyectoId:proyecto.id},select:{modulosSugeridos:true}});
  const curr=Array.isArray(current?.modulosSugeridos)?current.modulosSugeridos.map(String):[];
  const merged=Array.from(new Set([...curr,"Proyecto ejecutivo","Autorizaciones y permisos","Liberación para construir"]));

  await prisma.constructibilidadPM.upsert({
    where:{proyectoId:proyecto.id},
    create:{
      proyectoId:proyecto.id,
      proyectoEjecutivo,
      autorizacionesConstruccion,
      entregablesPaso7:entregables,
      riesgosPaso7:risks,
      modulosSugeridos:merged,
      progresoPaso7:avance,
      estadoPaso7:avance>=80?"COMPLETO":"EN_PROCESO",
    },
    update:{
      proyectoEjecutivo,
      autorizacionesConstruccion,
      entregablesPaso7:entregables,
      riesgosPaso7:risks,
      modulosSugeridos:merged,
      progresoPaso7:avance,
      estadoPaso7:avance>=80?"COMPLETO":"EN_PROCESO",
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/proyecto`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/proyecto?guardado=1`);
}
