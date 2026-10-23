"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();
const asList=(v:unknown)=>Array.isArray(v)?v:[];
const asObj=(v:unknown)=>(v&&typeof v==="object"&&!Array.isArray(v)?v:{}) as Record<string,unknown>;

function hashPayload(payload:unknown){
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function generarLineaBase(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);

  const c=await prisma.constructibilidadPM.findUnique({where:{proyectoId:proyecto.id}});
  if(!c) redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad?error=sin_constructibilidad`);

  const cierre=asObj(c.cierreConstructibilidad);
  const estadoConstructibilidad=String(c.estadoPaso12??"BORRADOR");
  if(!["LISTO_PARA_LINEA_BASE","LISTO_PARA_EJECUCION"].includes(estadoConstructibilidad)){
    redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/cierre?error=no_liberado`);
  }

  const alcance={
    tipoProyecto:asObj(c.productoEscala).tipoProyecto??null,
    productoEscala:c.productoEscala,
    modulosActivos:asList(c.matrizMaestraConfiguracion),
    alcanceObservado:asObj(c.productoEscala).observaciones??"",
  };
  const presupuesto={
    base:c.presupuestoBase,
    montoProyecto:proyecto.presupuesto,
  };
  const programa={
    base:c.programaMaestro,
    fechaInicioProyecto:proyecto.fechaInicio,
    fechaFinPlanProyecto:proyecto.fechaFinPlan,
  };
  const estructuraFisica={
    control:c.estructuraControl,
    jerarquia:asObj(c.estructuraControl).jerarquia??[],
  };
  const contratos={
    estrategia:c.estrategiaEjecucion,
    contratacion:c.contratacionSuministros,
  };
  const expedienteResumen={
    estado:c.estadoPaso11,
    progreso:c.progresoPaso11,
    entregables:asList(c.expedienteMaestroGenerado).length,
  };
  const liberaciones=c.liberacionesMaestras;
  const indicadoresBase={
    avanceFisico:0,
    avanceFinanciero:0,
    costoOriginal:Number(proyecto.presupuesto),
    fechaCorte:null,
    avanceConstructibilidad:Number(cierre.avanceGlobal??c.progresoPaso12??0),
  };
  const riesgosBase=[
    ...asList(c.riesgosPaso12),
    ...asList(c.riesgosPaso11),
  ];
  const payload={alcance,presupuesto,programa,estructuraFisica,contratos,expedienteResumen,liberaciones,indicadoresBase,riesgosBase};

  await prisma.lineaBasePM.upsert({
    where:{proyectoId:proyecto.id},
    create:{
      proyectoId:proyecto.id,
      version:1,
      estado:"BORRADOR",
      ...payload,
      cambiosBase:[],
      hashReferencia:hashPayload(payload),
    },
    update:{
      estado:"BORRADOR",
      ...payload,
      hashReferencia:hashPayload(payload),
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/linea-base`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/linea-base?generada=1`);
}

export async function aprobarLineaBase(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  const motivo=clean(formData.get("motivo"));
  if(!codigo) return;
  const {proyecto,userId}=await requireProjectWriteAccess(codigo);

  const lb=await prisma.lineaBasePM.findUnique({where:{proyectoId:proyecto.id}});
  if(!lb) redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/linea-base?error=sin_linea_base`);

  const required=[
    lb.alcance,lb.presupuesto,lb.programa,lb.estructuraFisica,lb.expedienteResumen,lb.liberaciones
  ];
  if(required.some(x=>x==null)){
    redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/linea-base?error=incompleta`);
  }

  await prisma.lineaBasePM.update({
    where:{proyectoId:proyecto.id},
    data:{
      estado:"APROBADA",
      aprobadoPorId:userId,
      aprobadoEn:new Date(),
      motivoAprobacion:motivo||"Aprobación de línea base definitiva",
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/linea-base`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/linea-base?aprobada=1`);
}
