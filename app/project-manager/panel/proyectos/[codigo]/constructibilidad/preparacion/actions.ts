"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();
const checked=(fd:FormData,k:string)=>fd.get(k)==="on";

export async function guardarPreparacionConstructibilidad(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);

  const contratacionSuministros={
    contratosClave:checked(formData,"contratosClave"),
    alcancesCerrados:checked(formData,"alcancesCerrados"),
    garantias:checked(formData,"garantias"),
    programaCompras:checked(formData,"programaCompras"),
    proveedoresCriticos:checked(formData,"proveedoresCriticos"),
    ordenesCompra:checked(formData,"ordenesCompra"),
    almacenDefinido:checked(formData,"almacenDefinido"),
    responsablesSuministro:checked(formData,"responsablesSuministro"),
    observaciones:clean(formData.get("contratacionObservaciones")),
  };

  const preparacionObra={
    campamento:checked(formData,"campamento"),
    oficinas:checked(formData,"oficinas"),
    bodega:checked(formData,"bodega"),
    seguridad:checked(formData,"seguridad"),
    accesosProvisionales:checked(formData,"accesosProvisionales"),
    energiaProvisional:checked(formData,"energiaProvisional"),
    aguaProvisional:checked(formData,"aguaProvisional"),
    senalizacion:checked(formData,"senalizacion"),
    trazoControl:checked(formData,"trazoControl"),
    personalTecnico:checked(formData,"personalTecnico"),
    contratistasMovilizados:checked(formData,"contratistasMovilizados"),
    planSeguridad:checked(formData,"planSeguridad"),
    bitacora:checked(formData,"bitacora"),
    observaciones:clean(formData.get("preparacionObservaciones")),
  };

  const riesgos:string[]=[];
  const entregables:string[]=[
    "Matriz de contratación inicial",
    "Programa de compras y suministros",
    "Checklist de preparación de obra",
    "Acta / condición de Listo para Inicio"
  ];

  const contractKeys=["contratosClave","alcancesCerrados","programaCompras","proveedoresCriticos","almacenDefinido","responsablesSuministro"] as const;
  const prepKeys=["campamento","seguridad","accesosProvisionales","energiaProvisional","aguaProvisional","trazoControl","personalTecnico","planSeguridad","bitacora"] as const;

  for(const k of contractKeys){
    if(!(contratacionSuministros as Record<string,unknown>)[k]) risks.push(`Contratación/suministros pendiente: ${k}`);
  }
  for(const k of prepKeys){
    if(!(preparacionObra as Record<string,unknown>)[k]) risks.push(`Preparación de obra pendiente: ${k}`);
  }

  const total=contractKeys.length+prepKeys.length;
  const completed=[
    ...contractKeys.map(k=>(contratacionSuministros as Record<string,unknown>)[k]===true),
    ...prepKeys.map(k=>(preparacionObra as Record<string,unknown>)[k]===true),
  ].filter(Boolean).length;
  const avance=Math.round((completed/total)*100);

  const current=await prisma.constructibilidadPM.findUnique({where:{proyectoId:proyecto.id},select:{modulosSugeridos:true}});
  const curr=Array.isArray(current?.modulosSugeridos)?current.modulosSugeridos.map(String):[];
  const merged=Array.from(new Set([...curr,"Contratación y suministros","Preparación de obra","Liberación de inicio"]));

  await prisma.constructibilidadPM.upsert({
    where:{proyectoId:proyecto.id},
    create:{
      proyectoId:proyecto.id,contratacionSuministros,preparacionObra,
      entregablesPaso9:entregables,riesgosPaso9:riesgos,modulosSugeridos:merged,
      progresoPaso9:avance,estadoPaso9:avance>=85?"LISTO_PARA_INICIO":"EN_PROCESO"
    },
    update:{
      contratacionSuministros,preparacionObra,
      entregablesPaso9:entregables,riesgosPaso9:riesgos,modulosSugeridos:merged,
      progresoPaso9:avance,estadoPaso9:avance>=85?"LISTO_PARA_INICIO":"EN_PROCESO"
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/preparacion`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/preparacion?guardado=1`);
}
