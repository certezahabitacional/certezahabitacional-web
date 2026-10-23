"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();
const checked=(fd:FormData,k:string)=>fd.get(k)==="on";
const asList=(v:unknown)=>Array.isArray(v)?v.map(String):[];

export async function generarExpedienteMaestro(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);

  const c=await prisma.constructibilidadPM.findUnique({where:{proyectoId:proyecto.id}});
  if(!c) redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad?error=sin_constructibilidad`);

  const stepDeliverables=[
    ...asList(c.entregablesPaso1),
    ...asList(c.entregablesPaso2),
    ...asList(c.entregablesPaso3),
    ...asList(c.entregablesPaso4),
    ...asList(c.entregablesPaso5),
    ...asList(c.entregablesPaso6),
    ...asList(c.entregablesPaso7),
    ...asList(c.entregablesPaso8),
    ...asList(c.entregablesPaso9),
    ...asList(c.entregablesPaso10),
  ];

  const unique=Array.from(new Set(stepDeliverables));
  const expediente=unique.map((nombre,index)=>({
    id:`EM-${String(index+1).padStart(3,"0")}`,
    nombre,
    clasificacion:"OBLIGATORIO",
    responsable:"",
    formato:"",
    fuente:"",
    fechaObjetivo:"",
    dependencia:"",
    criterioAceptacion:"",
    estado:"PENDIENTE",
  }));

  const pasos=[
    c.progresoPaso1,c.progresoPaso2,c.progresoPaso3,c.progresoPaso4,c.progresoPaso5,
    c.progresoPaso6,c.progresoPaso7,c.progresoPaso8,c.progresoPaso9,c.progresoPaso10
  ];
  const promedio=Math.round(pasos.reduce((a,b)=>a+b,0)/pasos.length);
  const riesgos:string[]=[];
  if(promedio<80) riesgos.push("Constructibilidad aún no alcanza 80% promedio en sus pasos");
  if(unique.length===0) riesgos.push("No existen entregables generados para construir el Expediente Maestro");

  const progreso=unique.length>0?Math.min(100,promedio):0;

  await prisma.constructibilidadPM.update({
    where:{proyectoId:proyecto.id},
    data:{
      expedienteMaestroGenerado:expediente,
      entregablesPaso11:[
        "Matriz consolidada del Expediente Maestro de Arranque",
        "Lista de entregables obligatorios y condicionales",
        "Matriz de responsables, fuentes y criterios de aceptación",
      ],
      riesgosPaso11:riesgos,
      progresoPaso11:progreso,
      estadoPaso11:progreso>=80?"GENERADO":"EN_PROCESO",
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/expediente`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/expediente?generado=1`);
}

export async function actualizarExpedienteMaestro(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);
  const current=await prisma.constructibilidadPM.findUnique({where:{proyectoId:proyecto.id},select:{expedienteMaestroGenerado:true}});
  const rows=Array.isArray(current?.expedienteMaestroGenerado)?current.expedienteMaestroGenerado as any[]:[];
  const updated=rows.map(row=>{
    const id=String(row.id);
    return {
      ...row,
      clasificacion:clean(formData.get(`${id}_clasificacion`))||row.clasificacion,
      responsable:clean(formData.get(`${id}_responsable`)),
      formato:clean(formData.get(`${id}_formato`)),
      fuente:clean(formData.get(`${id}_fuente`)),
      fechaObjetivo:clean(formData.get(`${id}_fecha`)),
      dependencia:clean(formData.get(`${id}_dependencia`)),
      criterioAceptacion:clean(formData.get(`${id}_criterio`)),
      estado:clean(formData.get(`${id}_estado`))||"PENDIENTE",
      validado:checked(formData,`${id}_validado`),
    };
  });

  const completos=updated.filter(x=>x.estado==="COMPLETO"||x.estado==="NO_APLICA").length;
  const progreso=updated.length?Math.round((completos/updated.length)*100):0;

  await prisma.constructibilidadPM.update({
    where:{proyectoId:proyecto.id},
    data:{
      expedienteMaestroGenerado:updated,
      progresoPaso11:progreso,
      estadoPaso11:progreso>=90?"EXPEDIENTE_LISTO":"EN_PROCESO",
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/expediente`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/expediente?guardado=1`);
}
