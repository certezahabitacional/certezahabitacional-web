"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();

const SERVICES=[
  "agua","drenaje","pluvial","electricidad","gas","telecomunicaciones","vialidades","alumbrado"
] as const;

function service(fd:FormData,key:string){
  return {
    estado:clean(fd.get(`${key}Estado`)),
    capacidad:clean(fd.get(`${key}Capacidad`)),
    puntoConexion:clean(fd.get(`${key}Punto`)),
    distancia:clean(fd.get(`${key}Distancia`)),
    responsable:clean(fd.get(`${key}Responsable`)),
    observaciones:clean(fd.get(`${key}Observaciones`)),
  };
}

function evaluateServices(data:Record<string,ReturnType<typeof service>>){
  const risks:string[]=[];
  const works=new Set<string>();
  const deliverables=new Set<string>([
    "Matriz de factibilidad de servicios",
    "Plano de puntos de conexión",
    "Matriz de obras requeridas",
    "Estimación preliminar de costos de infraestructura",
  ]);

  const evaluate=(name:string,s:ReturnType<typeof service>)=>{
    if(!s.estado || s.estado==="DESCONOCIDO" || s.estado==="SIN_FACTIBILIDAD"){
      risks.push(`${name}: factibilidad no resuelta`);
    }
    if(s.estado==="REQUIERE_EXTENSION") works.add(`Extensión de red de ${name.toLowerCase()}`);
    if(s.estado==="REQUIERE_NUEVA_INFRAESTRUCTURA") works.add(`Nueva infraestructura de ${name.toLowerCase()}`);
    if(s.estado==="CAPACIDAD_INSUFICIENTE") risks.push(`${name}: capacidad insuficiente`);
  };

  evaluate("Agua",data.agua);
  evaluate("Drenaje",data.drenaje);
  evaluate("Pluvial",data.pluvial);
  evaluate("Electricidad",data.electricidad);
  evaluate("Gas",data.gas);
  evaluate("Telecomunicaciones",data.telecomunicaciones);
  evaluate("Vialidades",data.vialidades);
  evaluate("Alumbrado",data.alumbrado);

  const d=data.drenaje;
  if(/carcamo/i.test(d.observaciones)) works.add("Cárcamo sanitario");
  if(/ptar|planta de tratamiento/i.test(d.observaciones)) works.add("PTAR");
  if(/colector/i.test(d.observaciones)) works.add("Colector sanitario");
  const a=data.agua;
  if(/pozo/i.test(a.observaciones)) works.add("Pozo");
  if(/tanque/i.test(a.observaciones)) works.add("Tanque de almacenamiento");
  const e=data.electricidad;
  if(/subestacion|subestación/i.test(e.observaciones)) works.add("Subestación eléctrica");
  if(/planta de emergencia/i.test(e.observaciones)) works.add("Planta de emergencia");
  const p=data.pluvial;
  if(/carcamo/i.test(p.observaciones)) works.add("Cárcamo pluvial");
  if(/canal|vaso|detencion|detención/i.test(p.observaciones)) works.add("Obras pluviales especiales");

  for(const x of works) deliverables.add(`Anteproyecto / alcance: ${x}`);

  return {risks,works:Array.from(works),deliverables:Array.from(deliverables)};
}

function progress(data:Record<string,ReturnType<typeof service>>){
  let completed=0;
  for(const key of SERVICES){
    const s=data[key];
    if(s.estado) completed++;
    if(s.responsable) completed+=0.25;
    if(s.estado==="EXISTE" || s.estado==="DISPONIBLE" || s.estado==="NO_APLICA") completed+=0.25;
  }
  return Math.min(100,Math.round((completed/(SERVICES.length*1.5))*100));
}

export async function guardarServiciosConstructibilidad(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);

  const data=Object.fromEntries(SERVICES.map(k=>[k,service(formData,k)])) as Record<string,ReturnType<typeof service>>;
  const result=evaluateServices(data);
  const avance=progress(data);

  const current=await prisma.constructibilidadPM.findUnique({
    where:{proyectoId:proyecto.id},
    select:{modulosSugeridos:true}
  });
  const currentModules=Array.isArray(current?.modulosSugeridos)?current.modulosSugeridos.map(String):[];
  const mergedModules=Array.from(new Set([
    ...currentModules,
    "Factibilidad de servicios",
    ...result.works.map(x=>`Obra especial: ${x}`)
  ]));

  await prisma.constructibilidadPM.upsert({
    where:{proyectoId:proyecto.id},
    create:{
      proyectoId:proyecto.id,
      serviciosInfraestructura:data,
      obrasEspecialesSugeridas:result.works,
      entregablesPaso3:result.deliverables,
      riesgosPaso3:result.risks,
      modulosSugeridos:mergedModules,
      progresoPaso3:avance,
      estadoPaso3:avance>=80?"COMPLETO":"EN_PROCESO",
    },
    update:{
      serviciosInfraestructura:data,
      obrasEspecialesSugeridas:result.works,
      entregablesPaso3:result.deliverables,
      riesgosPaso3:result.risks,
      modulosSugeridos:mergedModules,
      progresoPaso3:avance,
      estadoPaso3:avance>=80?"COMPLETO":"EN_PROCESO",
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/servicios`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/servicios?guardado=1`);
}
