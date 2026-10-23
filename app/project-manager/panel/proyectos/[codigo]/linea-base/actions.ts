"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();
const asList=(v:unknown)=>Array.isArray(v)?v:[];
const asObj=(v:unknown)=>(v&&typeof v==="object"&&!Array.isArray(v)?v:{}) as Record<string,unknown>;

function hashPayload(payload:unknown){
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function toJson(value:unknown):Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
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

  const alcance=toJson({
    tipoProyecto:String(asObj(c.productoEscala).tipoProyecto??""),
    productoEscala:c.productoEscala ?? {},
    modulosActivos:asList(c.matrizMaestraConfiguracion),
    alcanceObservado:String(asObj(c.productoEscala).observaciones??""),
  });
  const presupuesto=toJson({
    base:c.presupuestoBase ?? {},
    montoProyecto:Number(proyecto.presupuesto),
  });
  const programa=toJson({
    base:c.programaMaestro ?? {},
    fechaInicioProyecto:proyecto.fechaInicio?.toISOString() ?? null,
    fechaFinPlanProyecto:proyecto.fechaFinPlan?.toISOString() ?? null,
  });
  const estructuraFisica=toJson({
    control:c.estructuraControl ?? {},
    jerarquia:asList(asObj(c.estructuraControl).jerarquia),
  });
  const contratos=toJson({
    estrategia:c.estrategiaEjecucion ?? {},
    contratacion:c.contratacionSuministros ?? {},
  });
  const expedienteResumen=toJson({
    estado:c.estadoPaso11,
    progreso:c.progresoPaso11,
    entregables:asList(c.expedienteMaestroGenerado).length,
  });
  const liberaciones=toJson(c.liberacionesMaestras ?? []);
  const indicadoresBase=toJson({
    avanceFisico:0,
    avanceFinanciero:0,
    costoOriginal:Number(proyecto.presupuesto),
    fechaCorte:null,
    avanceConstructibilidad:Number(cierre.avanceGlobal??c.progresoPaso12??0),
  });
  const riesgosBase=toJson([
    ...asList(c.riesgosPaso12),
    ...asList(c.riesgosPaso11),
  ]);
  const payload={alcance,presupuesto,programa,estructuraFisica,contratos,expedienteResumen,liberaciones,indicadoresBase,riesgosBase};

  await prisma.lineaBasePM.upsert({
    where:{proyectoId:proyecto.id},
    create:{
      proyectoId:proyecto.id,
      version:1,
      estado:"BORRADOR",
      ...payload,
      cambiosBase:toJson([]),
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
