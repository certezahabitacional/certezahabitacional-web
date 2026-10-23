"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();

const STUDIES=[
  "topografia","mecanicaSuelos","geotecnia","hidrologia","hidraulica","impactoAmbiental",
  "impactoUrbano","transito","riesgo","proteccionCivil","contaminacion","infraestructura"
] as const;

function study(fd:FormData,key:string){
  return {
    requerido:clean(fd.get(`${key}Requerido`)),
    estado:clean(fd.get(`${key}Estado`)),
    responsable:clean(fd.get(`${key}Responsable`)),
    fecha:clean(fd.get(`${key}Fecha`)),
    resultado:clean(fd.get(`${key}Resultado`)),
    observaciones:clean(fd.get(`${key}Observaciones`)),
  };
}

function progress(data:Record<string,ReturnType<typeof study>>){
  const req=Object.values(data).filter(x=>x.requerido==="SI");
  if(!req.length) return 100;
  const done=req.filter(x=>x.estado==="TERMINADO"||x.estado==="APROBADO").length;
  const inProcess=req.filter(x=>x.estado==="CONTRATADO"||x.estado==="EN_PROCESO"||x.estado==="EN_REVISION").length;
  return Math.min(100,Math.round(((done + inProcess*0.5)/req.length)*100));
}

export async function guardarEstudiosConstructibilidad(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);

  const data=Object.fromEntries(STUDIES.map(k=>[k,study(formData,k)])) as Record<string,ReturnType<typeof study>>;
  const riesgos:string[]=[];
  const entregables:string[]=[];

  for(const [key,s] of Object.entries(data)){
    if(s.requerido==="SI"){
      const nombre=key.replace(/([A-Z])/g," $1").replace(/^./,m=>m.toUpperCase());
      entregables.push(`Estudio / dictamen: ${nombre}`);
      if(!s.estado || s.estado==="PENDIENTE") riesgos.push(`${nombre}: pendiente`);
      if(s.estado==="OBSERVADO") riesgos.push(`${nombre}: con observaciones`);
    }
  }

  const avance=progress(data);

  await prisma.constructibilidadPM.upsert({
    where:{proyectoId:proyecto.id},
    create:{
      proyectoId:proyecto.id,
      estudiosEspecializados:data,
      entregablesPaso4:entregables,
      riesgosPaso4:riesgos,
      progresoPaso4:avance,
      estadoPaso4:avance>=80?"COMPLETO":"EN_PROCESO",
    },
    update:{
      estudiosEspecializados:data,
      entregablesPaso4:entregables,
      riesgosPaso4:riesgos,
      progresoPaso4:avance,
      estadoPaso4:avance>=80?"COMPLETO":"EN_PROCESO",
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/estudios`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/estudios?guardado=1`);
}
