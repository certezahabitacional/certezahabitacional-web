"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();
const num=(v:FormDataEntryValue|null)=>{const n=Number(clean(v));return Number.isFinite(n)&&n>=0?n:0;};
const checked=(fd:FormData,k:string)=>fd.get(k)==="on";

const PACKAGES=["terracerias","urbanizacion","cimentacion","estructura","albanileria","instalaciones","acabados","obrasEspeciales"] as const;

function pkg(fd:FormData,key:string){
  return {
    modalidad:clean(fd.get(`${key}Modalidad`)),
    contrato:clean(fd.get(`${key}Contrato`)),
    suministro:clean(fd.get(`${key}Suministro`)),
    manoObra:clean(fd.get(`${key}ManoObra`)),
    maquinaria:clean(fd.get(`${key}Maquinaria`)),
    responsable:clean(fd.get(`${key}Responsable`)),
    observaciones:clean(fd.get(`${key}Observaciones`)),
  };
}

export async function guardarEjecucionConstructibilidad(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);

  const presupuestoBase={
    montoTotal:num(formData.get("montoTotal")),
    catalogoConceptos:checked(formData,"catalogoConceptos"),
    preciosUnitarios:checked(formData,"preciosUnitarios"),
    explosionInsumos:checked(formData,"explosionInsumos"),
    tabuladorManoObra:checked(formData,"tabuladorManoObra"),
    cargaSocial:checked(formData,"cargaSocial"),
    provisionesLaborales:checked(formData,"provisionesLaborales"),
    maquinaria:checked(formData,"maquinariaPresupuestada"),
    subcontratos:checked(formData,"subcontratosPresupuestados"),
    indirectos:checked(formData,"indirectos"),
    contingencia:checked(formData,"contingencia"),
    flujoEconomico:checked(formData,"flujoEconomico"),
  };

  const programaMaestro={
    fechaInicio:clean(formData.get("fechaInicio")),
    fechaFin:clean(formData.get("fechaFin")),
    hitos:checked(formData,"hitos"),
    rutaCritica:checked(formData,"rutaCritica"),
    programaEtapas:checked(formData,"programaEtapas"),
    programaSuministros:checked(formData,"programaSuministros"),
    programaContratacion:checked(formData,"programaContratacion"),
  };

  const estrategiaEjecucion={
    modalidadGeneral:clean(formData.get("modalidadGeneral")),
    paquetes:Object.fromEntries(PACKAGES.map(k=>[k,pkg(formData,k)])),
  };

  const entregables=new Set<string>([
    "Presupuesto base autorizado",
    "Programa maestro",
    "Matriz de estrategia de ejecución por paquete",
  ]);
  const riesgos:string[]=[];
  const modulos=new Set<string>();

  if(!presupuestoBase.catalogoConceptos) riesgos.push("Catálogo de conceptos pendiente");
  if(!presupuestoBase.preciosUnitarios) riesgos.push("Análisis de precios unitarios pendiente");
  if(!presupuestoBase.explosionInsumos) riesgos.push("Explosión de insumos pendiente");
  if(!programaMaestro.fechaInicio || !programaMaestro.fechaFin) riesgos.push("Fechas base del programa no definidas");
  if(!programaMaestro.rutaCritica) riesgos.push("Ruta crítica no definida");
  if(!estrategiaEjecucion.modalidadGeneral) riesgos.push("Modalidad general de ejecución no definida");

  for(const [key,p] of Object.entries(estrategiaEjecucion.paquetes as Record<string,ReturnType<typeof pkg>>)){
    if(!p.modalidad) continue;
    if(p.modalidad==="DIRECTA"){
      modulos.add("Mano de obra y cuadrillas");
      modulos.add("Compras e inventarios");
      modulos.add("Maquinaria y productividad");
      entregables.add("Presupuesto disponible de mano de obra por concepto");
      entregables.add("Tabuladores y cargas sociales");
    }
    if(p.modalidad==="SUBCONTRATO"){
      modulos.add("Contratos y subcontratos");
      modulos.add("Estimaciones y pagos");
      entregables.add("Matriz contractual y alcances");
    }
    if(p.modalidad==="MIXTO"){
      modulos.add("Control mixto por paquete");
      modulos.add("Contratos y subcontratos");
      modulos.add("Compras e inventarios");
    }
    if(p.suministro==="PROYECTO"){
      modulos.add("Compras e inventarios");
      entregables.add("Programa de suministros");
    }
  }

  const requiredBudget=[
    presupuestoBase.catalogoConceptos,presupuestoBase.preciosUnitarios,presupuestoBase.explosionInsumos,
    presupuestoBase.indirectos,presupuestoBase.contingencia,presupuestoBase.flujoEconomico
  ];
  const budgetPct=Math.round((requiredBudget.filter(Boolean).length/requiredBudget.length)*35);
  const schedulePct=Math.round(([
    programaMaestro.fechaInicio,programaMaestro.fechaFin,programaMaestro.hitos,programaMaestro.rutaCritica
  ].filter(Boolean).length/4)*30);
  const packagesDefined=Object.values(estrategiaEjecucion.paquetes as Record<string,ReturnType<typeof pkg>>).filter(x=>x.modalidad).length;
  const executionPct=Math.round((packagesDefined/PACKAGES.length)*35);
  const avance=Math.min(100,budgetPct+schedulePct+executionPct);

  const current=await prisma.constructibilidadPM.findUnique({where:{proyectoId:proyecto.id},select:{modulosSugeridos:true}});
  const curr=Array.isArray(current?.modulosSugeridos)?current.modulosSugeridos.map(String):[];
  const merged=Array.from(new Set([...curr,...Array.from(modulos),"Presupuesto","Programa maestro","Estrategia de ejecución"]));

  await prisma.constructibilidadPM.upsert({
    where:{proyectoId:proyecto.id},
    create:{
      proyectoId:proyecto.id,presupuestoBase,programaMaestro,estrategiaEjecucion,
      entregablesPaso8:Array.from(entregables),riesgosPaso8:riesgos,modulosSugeridos:merged,
      progresoPaso8:avance,estadoPaso8:avance>=80?"COMPLETO":"EN_PROCESO"
    },
    update:{
      presupuestoBase,programaMaestro,estrategiaEjecucion,
      entregablesPaso8:Array.from(entregables),riesgosPaso8:riesgos,modulosSugeridos:merged,
      progresoPaso8:avance,estadoPaso8:avance>=80?"COMPLETO":"EN_PROCESO"
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/ejecucion`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/ejecucion?guardado=1`);
}
