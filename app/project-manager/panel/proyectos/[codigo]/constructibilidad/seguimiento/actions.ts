"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();
const checked=(fd:FormData,k:string)=>fd.get(k)==="on";

const AREAS=[
  "avanceFisico","avanceFinanciero","contratos","manoObra","materiales","maquinaria",
  "calidad","seguridad","cambios","riesgos","restricciones","evidencias"
] as const;

function area(fd:FormData,key:string){
  return {
    activo:checked(fd,`${key}Activo`),
    frecuencia:clean(fd.get(`${key}Frecuencia`)),
    responsable:clean(fd.get(`${key}Responsable`)),
    fuente:clean(fd.get(`${key}Fuente`)),
    dato:clean(fd.get(`${key}Dato`)),
    calculo:clean(fd.get(`${key}Calculo`)),
    indicador:clean(fd.get(`${key}Indicador`)),
    alerta:clean(fd.get(`${key}Alerta`)),
    moduloDestino:clean(fd.get(`${key}Modulo`)),
  };
}

export async function guardarSeguimientoConstructibilidad(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);

  const seguimientoOperativo=Object.fromEntries(AREAS.map(k=>[k,area(formData,k)]));
  const matriz=Object.entries(seguimientoOperativo as Record<string,ReturnType<typeof area>>)
    .filter(([,v])=>v.activo)
    .map(([key,v])=>({
      area:key,
      dato:v.dato,
      responsable:v.responsable,
      frecuencia:v.frecuencia,
      fuente:v.fuente,
      calculo:v.calculo,
      indicador:v.indicador,
      moduloDestino:v.moduloDestino,
      alerta:v.alerta,
    }));

  const riesgos:string[]=[];
  for(const [key,v] of Object.entries(seguimientoOperativo as Record<string,ReturnType<typeof area>>)){
    if(!v.activo) continue;
    if(!v.frecuencia) riesgos.push(`${key}: frecuencia no definida`);
    if(!v.responsable) riesgos.push(`${key}: responsable no definido`);
    if(!v.dato) riesgos.push(`${key}: dato de captura no definido`);
    if(!v.moduloDestino) riesgos.push(`${key}: módulo destino no definido`);
  }

  const activos=Object.values(seguimientoOperativo as Record<string,ReturnType<typeof area>>).filter(x=>x.activo);
  const completos=activos.filter(x=>x.frecuencia&&x.responsable&&x.dato&&x.moduloDestino).length;
  const avance=activos.length?Math.round((completos/activos.length)*100):0;

  const entregables=[
    "Matriz de seguimiento operativo",
    "Matriz de responsables y frecuencias",
    "Mapa de captura única y módulos destino",
    "Matriz de indicadores y alertas",
  ];

  await prisma.constructibilidadPM.upsert({
    where:{proyectoId:proyecto.id},
    create:{
      proyectoId:proyecto.id,
      seguimientoOperativo,
      matrizSeguimiento:matriz,
      entregablesPaso10:entregables,
      riesgosPaso10:riesgos,
      progresoPaso10:avance,
      estadoPaso10:avance>=85?"COMPLETO":"EN_PROCESO",
    },
    update:{
      seguimientoOperativo,
      matrizSeguimiento:matriz,
      entregablesPaso10:entregables,
      riesgosPaso10:riesgos,
      progresoPaso10:avance,
      estadoPaso10:avance>=85?"COMPLETO":"EN_PROCESO",
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/seguimiento`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/seguimiento?guardado=1`);
}
