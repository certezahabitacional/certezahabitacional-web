"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();
const asList=(v:unknown)=>Array.isArray(v)?v.map(String):[];
const asObj=(v:unknown)=>(v&&typeof v==="object"&&!Array.isArray(v)?v:{}) as Record<string,unknown>;

function statusFrom(data:{
  avg:number;
  expediente:number;
  preparacion:number;
  seguimiento:number;
  proyecto:number;
  criticalRisks:number;
}) {
  if(data.avg<50) return "NO_CONFIGURADO";
  if(data.proyecto<70 || data.expediente<70 || data.seguimiento<70) return "CONFIGURADO_CON_CONDICIONES";
  if(data.preparacion<85) return "LISTO_PARA_LINEA_BASE";
  if(data.criticalRisks>0) return "LISTO_PARA_LINEA_BASE";
  return "LISTO_PARA_EJECUCION";
}

export async function cerrarConstructibilidad(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);

  const c=await prisma.constructibilidadPM.findUnique({where:{proyectoId:proyecto.id}});
  if(!c) redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad?error=sin_constructibilidad`);

  const pasos=[
    c.progresoPaso1,c.progresoPaso2,c.progresoPaso3,c.progresoPaso4,c.progresoPaso5,c.progresoPaso6,
    c.progresoPaso7,c.progresoPaso8,c.progresoPaso9,c.progresoPaso10,c.progresoPaso11
  ];
  const avg=Math.round(pasos.reduce((a,b)=>a+b,0)/pasos.length);

  const riesgos=[
    ...asList(c.riesgosPaso1),...asList(c.riesgosPaso2),...asList(c.riesgosPaso3),...asList(c.riesgosPaso4),
    ...asList(c.riesgosPaso5),...asList(c.riesgosPaso6),...asList(c.riesgosPaso7),...asList(c.riesgosPaso8),
    ...asList(c.riesgosPaso9),...asList(c.riesgosPaso10),...asList(c.riesgosPaso11)
  ];
  const uniqueRisks=Array.from(new Set(riesgos));

  const modules=Array.from(new Set(asList(c.modulosSugeridos)));
  const expediente=Array.isArray(c.expedienteMaestroGenerado)?c.expedienteMaestroGenerado as any[]:[];
  const tracking=Array.isArray(c.matrizSeguimiento)?c.matrizSeguimiento as any[]:[];

  const liberationRows=[
    {id:"LIB-01",nombre:"Predio identificado y disponible",estado:c.progresoPaso1>=80?"LIBERADO":"PENDIENTE",dependencia:"Paso 1"},
    {id:"LIB-02",nombre:"Viabilidad jurídica / urbanística",estado:c.progresoPaso2>=80?"LIBERADO":"PENDIENTE",dependencia:"Paso 2"},
    {id:"LIB-03",nombre:"Servicios e infraestructura definidos",estado:c.progresoPaso3>=80?"LIBERADO":"PENDIENTE",dependencia:"Paso 3"},
    {id:"LIB-04",nombre:"Estudios críticos resueltos",estado:c.progresoPaso4>=80?"LIBERADO":"PENDIENTE",dependencia:"Paso 4"},
    {id:"LIB-05",nombre:"Producto y escala definidos",estado:c.progresoPaso5>=80?"LIBERADO":"PENDIENTE",dependencia:"Paso 5"},
    {id:"LIB-06",nombre:"Mercado y financiamiento definidos",estado:c.progresoPaso6>=80?"LIBERADO":"PENDIENTE",dependencia:"Paso 6"},
    {id:"LIB-07",nombre:"Proyecto ejecutivo y permisos",estado:c.progresoPaso7>=80?"LIBERADO":"PENDIENTE",dependencia:"Paso 7"},
    {id:"LIB-08",nombre:"Presupuesto, programa y estrategia",estado:c.progresoPaso8>=80?"LIBERADO":"PENDIENTE",dependencia:"Paso 8"},
    {id:"LIB-09",nombre:"Preparación física para iniciar",estado:c.estadoPaso9==="LISTO_PARA_INICIO"?"LIBERADO":"PENDIENTE",dependencia:"Paso 9"},
    {id:"LIB-10",nombre:"Seguimiento operativo configurado",estado:c.progresoPaso10>=85?"LIBERADO":"PENDIENTE",dependencia:"Paso 10"},
    {id:"LIB-11",nombre:"Expediente Maestro integrado",estado:c.estadoPaso11==="EXPEDIENTE_LISTO"?"LIBERADO":"PENDIENTE",dependencia:"Paso 11"},
  ];

  const criticalRisks=uniqueRisks.filter(r=>/litigio|sin factibilidad|licencia|acceso legal|capacidad insuficiente|uso de suelo|pendiente/i.test(r)).length;
  const estadoFinal=statusFrom({
    avg,
    expediente:c.progresoPaso11,
    preparacion:c.progresoPaso9,
    seguimiento:c.progresoPaso10,
    proyecto:c.progresoPaso7,
    criticalRisks
  });

  const matrizMaestra=modules.map((nombre,index)=>({
    id:`MOD-${String(index+1).padStart(3,"0")}`,
    modulo:nombre,
    activo:true,
    origen:"Constructibilidad",
    dependencia:"",
    responsable:"",
    estado:"ACTIVO",
  }));

  const cierre={
    estadoFinal,
    avanceGlobal:avg,
    riesgosAbiertos:uniqueRisks.length,
    riesgosCriticos:criticalRisks,
    modulosActivos:modules.length,
    entregablesExpediente:expediente.length,
    reglasSeguimiento:tracking.length,
    fechaCierre:new Date().toISOString(),
  };

  await prisma.constructibilidadPM.update({
    where:{proyectoId:proyecto.id},
    data:{
      cierreConstructibilidad:cierre,
      matrizMaestraConfiguracion:matrizMaestra,
      liberacionesMaestras:liberationRows,
      entregablesPaso12:[
        "Matriz Maestra de Configuración del Proyecto",
        "Matriz de Módulos Activos",
        "Matriz de Liberaciones y Dependencias",
        "Dictamen final de Constructibilidad",
      ],
      riesgosPaso12:uniqueRisks,
      progresoPaso12:avg,
      estadoPaso12:estadoFinal,
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/cierre`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad/cierre?generado=1`);
}
