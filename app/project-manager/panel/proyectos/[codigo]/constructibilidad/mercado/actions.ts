"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();
const checked=(fd:FormData,k:string)=>fd.get(k)==="on";
const num=(v:FormDataEntryValue|null)=>{ const n=Number(clean(v)); return Number.isFinite(n)&&n>=0?n:0; };

export async function guardarMercadoConstructibilidad(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);

  const mercado={
    infonavit:checked(formData,"infonavit"),
    fovissste:checked(formData,"fovissste"),
    bancario:checked(formData,"bancario"),
    recursosComprador:checked(formData,"recursosComprador"),
    renta:checked(formData,"renta"),
    institucional:checked(formData,"institucional"),
    porcentajeInfonavit:num(formData.get("porcentajeInfonavit")),
    porcentajeBancario:num(formData.get("porcentajeBancario")),
    porcentajeOtros:num(formData.get("porcentajeOtros")),
    observaciones:clean(formData.get("mercadoObservaciones")),
  };

  const financiamiento={
    recursosPropios:checked(formData,"recursosPropios"),
    creditoPuente:checked(formData,"creditoPuente"),
    lineaBancaria:checked(formData,"lineaBancaria"),
    inversionistas:checked(formData,"inversionistas"),
    preventas:checked(formData,"preventas"),
    fideicomiso:checked(formData,"fideicomiso"),
    banco:clean(formData.get("banco")),
    montoCredito:num(formData.get("montoCredito")),
    aforo:clean(formData.get("aforo")),
    ministraciones:clean(formData.get("ministraciones")),
    supervisionBancaria:checked(formData,"supervisionBancaria"),
    observaciones:clean(formData.get("financiamientoObservaciones")),
  };

  const riesgos:string[]=[];
  const entregables:string[]=["Matriz de mercado / esquema de colocación","Plan financiero del proyecto"];
  const modulos=new Set<string>();

  if(mercado.infonavit){
    entregables.push("Requerimientos de expediente y liberación INFONAVIT");
    modulos.add("Control INFONAVIT / individualización");
  }
  if(mercado.fovissste){
    entregables.push("Requerimientos de expediente y liberación FOVISSSTE");
    modulos.add("Control FOVISSSTE");
  }
  if(mercado.bancario){
    entregables.push("Matriz de requisitos bancarios por vivienda / unidad");
    modulos.add("Control bancario de colocación");
  }
  if(financiamiento.creditoPuente){
    entregables.push("Plan de disposiciones y ministraciones");
    entregables.push("Matriz de aforo, supervisión y condiciones del crédito");
    modulos.add("Crédito puente y ministraciones");
    if(!financiamiento.banco) riesgos.push("Crédito puente seleccionado sin banco definido");
    if(financiamiento.montoCredito<=0) riesgos.push("Monto de crédito puente no definido");
  }
  if(financiamiento.fideicomiso) modulos.add("Control de fideicomiso");
  if(financiamiento.inversionistas) modulos.add("Control de inversionistas");
  if(financiamiento.preventas) modulos.add("Control de preventas y aplicación de recursos");

  const tieneMercado=mercado.infonavit||mercado.fovissste||mercado.bancario||mercado.recursosComprador||mercado.renta||mercado.institucional;
  const tieneFinanciamiento=financiamiento.recursosPropios||financiamiento.creditoPuente||financiamiento.lineaBancaria||financiamiento.inversionistas||financiamiento.preventas||financiamiento.fideicomiso;
  let avance=0;
  if(tieneMercado) avance+=40;
  if(tieneFinanciamiento) avance+=40;
  if(!financiamiento.creditoPuente || (financiamiento.banco&&financiamiento.montoCredito>0)) avance+=20;

  if(!tieneMercado) riesgos.push("Esquema de comercialización no definido");
  if(!tieneFinanciamiento) riesgos.push("Fuente de financiamiento del proyecto no definida");

  const current=await prisma.constructibilidadPM.findUnique({where:{proyectoId:proyecto.id},select:{modulosSugeridos:true}});
  const curr=Array.isArray(current?.modulosSugeridos)?current.modulosSugeridos.map(String):[];
  const merged=Array.from(new Set([...curr,...Array.from(modulos)]));

  await prisma.constructibilidadPM.upsert({
    where:{proyectoId:proyecto.id},
    create:{
      proyectoId:proyecto.id,
      mercadoComercializacion:mercado,
      financiamientoProyecto:financiamiento,
      entregablesPaso6:entregables,
      riesgosPaso6:riesgos,
      modulosSugeridos:merged,
      progresoPaso6:avance,
      estadoPaso6:avance>=80?"COMPLETO":"EN_PROCESO",
    },
    update:{
      mercadoComercializacion:mercado,
      financiamientoProyecto:financiamiento,
      entregablesPaso6:entregables,
      riesgosPaso6:riesgos,
      modulosSugeridos:merged,
      progresoPaso6:avance,
      estadoPaso6:avance>=80?"COMPLETO":"EN_PROCESO",
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/mercado`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/mercado?guardado=1`);
}
