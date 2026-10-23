"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();
const checked=(fd:FormData,k:string)=>fd.get(k)==="on";

function jsonGroup(fd:FormData, keys:string[]) {
  return Object.fromEntries(keys.map(k=>[k,checked(fd,k)]));
}

function suggestedModules(condicion:string, fd:FormData) {
  const set=new Set<string>(["Proyecto ejecutivo","Autorizaciones","Presupuesto","Programa","Calidad","Riesgos","Documentación"]);
  if(["BRENA","MACROLOTE_PARCIAL","LOTES_PARCIALES","MIXTO"].includes(condicion)){
    set.add("Habilitación del predio");
    set.add("Terracerías");
    set.add("Infraestructura");
    set.add("Urbanización");
  }
  if(checked(fd,"cauces")||checked(fd,"zonasInundables")) set.add("Hidrología / Obras pluviales");
  if(checked(fd,"rellenos")||checked(fd,"sueloEspecial")) set.add("Geotecnia");
  if(checked(fd,"construcciones")||condicion==="CONSTRUCCION_EXISTENTE"||condicion==="REMODELACION") set.add("Demoliciones / Rehabilitación");
  if(checked(fd,"interferenciasCriticas")) set.add("Reubicación de interferencias");
  if(!checked(fd,"accesoLegal")||!checked(fd,"accesoFisico")) set.add("Accesos y liberaciones");
  return Array.from(set);
}

function requiredDeliverables(condicion:string, fd:FormData) {
  const set=new Set<string>(["Ficha de condición inicial","Matriz de información disponible","Matriz de riesgos preliminares","Requerimientos del Expediente Maestro"]);
  if(!checked(fd,"topografia")) set.add("Levantamiento topográfico");
  if(!checked(fd,"mecanicaSuelos")) set.add("Estudio de mecánica de suelos");
  if(checked(fd,"cauces")||checked(fd,"zonasInundables")) set.add("Estudio hidrológico / hidráulico");
  if(!checked(fd,"limitesDefinidos")) set.add("Deslinde y definición de límites");
  if(!checked(fd,"accesoLegal")) set.add("Liberación / acreditación de acceso legal");
  if(["BRENA","MACROLOTE_PARCIAL","LOTES_PARCIALES","MIXTO"].includes(condicion)) set.add("Matriz de infraestructura y urbanización faltante");
  if(checked(fd,"interferenciasCriticas")) set.add("Plano y plan de manejo de interferencias");
  return Array.from(set);
}

function preliminaryRisks(fd:FormData) {
  const risks:string[]=[];
  if(!checked(fd,"limitesDefinidos")) risks.push("Límites del predio no confirmados");
  if(!checked(fd,"accesoLegal")) risks.push("Acceso legal pendiente");
  if(!checked(fd,"accesoFisico")) risks.push("Acceso físico pendiente o insuficiente");
  if(!checked(fd,"mecanicaSuelos")) risks.push("Mecánica de suelos pendiente");
  if(checked(fd,"rellenos")) risks.push("Posibles rellenos existentes");
  if(checked(fd,"sueloEspecial")) risks.push("Condición geotécnica especial");
  if(checked(fd,"cauces")) risks.push("Presencia de cauces o escurrimientos");
  if(checked(fd,"zonasInundables")) risks.push("Posible condición de inundabilidad");
  if(checked(fd,"interferenciasCriticas")) risks.push("Interferencias que pueden afectar el proyecto");
  return risks;
}

function progress(fd:FormData) {
  const keys=["limitesDefinidos","accesoLegal","accesoFisico","topografia","mecanicaSuelos"];
  const base=keys.filter(k=>checked(fd,k)).length;
  const condicion=clean(fd.get("condicionPredio"));
  const superficie=Number(clean(fd.get("superficieM2")));
  const numero=Number(clean(fd.get("numeroPredios")));
  let score=base*12;
  if(condicion) score+=15;
  if(Number.isFinite(superficie)&&superficie>0) score+=12;
  if(Number.isFinite(numero)&&numero>0) score+=8;
  if(clean(fd.get("disponibilidadFisica"))) score+=5;
  return Math.min(100,score);
}

export async function guardarPredioConstructibilidad(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);

  const condicionPredio=clean(formData.get("condicionPredio"));
  const superficieRaw=clean(formData.get("superficieM2"));
  const numeroRaw=clean(formData.get("numeroPredios"));
  const superficie=superficieRaw?Number(superficieRaw):null;
  const numeroPredios=numeroRaw?Number(numeroRaw):null;

  const identificacion={
    propietario:clean(formData.get("propietario")),
    claveCatastral:clean(formData.get("claveCatastral")),
    poligonoDisponible:checked(formData,"poligonoDisponible"),
  };
  const limitesAccesos=jsonGroup(formData,["limitesDefinidos","deslinde","accesoLegal","accesoFisico","accesoMaquinaria","derechoPaso"]);
  const topografiaSuelo=jsonGroup(formData,["topografia","bancoNivel","mecanicaSuelos","rellenos","sueloEspecial"]);
  const aguaDrenajeNatural=jsonGroup(formData,["escurrimientos","cauces","zonasInundables","obrasHidraulicas"]);
  const interferencias=jsonGroup(formData,["lineasElectricas","tuberias","colectores","pozos","construcciones","derechosVia","interferenciasCriticas"]);
  const urbanizacionExistente=jsonGroup(formData,["agua","drenaje","electricidad","pluvial","vialidades","alumbrado","telecomunicaciones"]);

  const avance=progress(formData);
  const riesgos=preliminaryRisks(formData);
  const entregables=requiredDeliverables(condicionPredio,formData);
  const modulos=suggestedModules(condicionPredio,formData);

  await prisma.constructibilidadPM.upsert({
    where:{proyectoId:proyecto.id},
    create:{
      proyectoId:proyecto.id,
      condicionPredio:condicionPredio||null,
      clasificacionDetalle:clean(formData.get("clasificacionDetalle"))||null,
      superficieM2:Number.isFinite(superficie as number)?superficie:null,
      numeroPredios:Number.isFinite(numeroPredios as number)?numeroPredios:null,
      disponibilidadFisica:clean(formData.get("disponibilidadFisica"))||null,
      identificacion,
      limitesAccesos,
      topografiaSuelo,
      aguaDrenajeNatural,
      interferencias,
      urbanizacionExistente,
      entregablesPaso1:entregables,
      riesgosPaso1:riesgos,
      modulosSugeridos:modulos,
      progresoPaso1:avance,
      estadoPaso1:avance>=80?"COMPLETO":"EN_PROCESO",
    },
    update:{
      condicionPredio:condicionPredio||null,
      clasificacionDetalle:clean(formData.get("clasificacionDetalle"))||null,
      superficieM2:Number.isFinite(superficie as number)?superficie:null,
      numeroPredios:Number.isFinite(numeroPredios as number)?numeroPredios:null,
      disponibilidadFisica:clean(formData.get("disponibilidadFisica"))||null,
      identificacion,
      limitesAccesos,
      topografiaSuelo,
      aguaDrenajeNatural,
      interferencias,
      urbanizacionExistente,
      entregablesPaso1:entregables,
      riesgosPaso1:riesgos,
      modulosSugeridos:modulos,
      progresoPaso1:avance,
      estadoPaso1:avance>=80?"COMPLETO":"EN_PROCESO",
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/predio`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/predio?guardado=1`);
}
