"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:FormDataEntryValue|null)=>String(v??"").trim();
const asObj=(v:unknown)=>(v&&typeof v==="object"&&!Array.isArray(v)?v:{}) as Record<string,unknown>;
const asList=(v:unknown)=>Array.isArray(v)?v.map(String):[];
const json=(v:unknown)=>JSON.parse(JSON.stringify(v??null)) as Prisma.InputJsonValue;

type DocDef={
  codigo:string;
  nombre:string;
  descripcion:string;
  tipo:string;
  obligatorio:boolean;
  moduloPrincipal:string;
  modulosDestino:string[];
  periodicidadDefault:string;
};

function buildDocs(c:any):DocDef[]{
  const docs:DocDef[]=[];
  const add=(d:DocDef)=>docs.push(d);

  const condicion=String(c?.condicionPredio??"");
  const estrategia=asObj(c?.estrategiaEjecucion);
  const paquetes=asObj(estrategia.paquetes);
  const servicios=asObj(c?.serviciosInfraestructura);
  const obrasEspeciales=asList(c?.obrasEspecialesSugeridas);
  const proyectoEjecutivo=asObj(c?.proyectoEjecutivo);

  const requiereHabilitacion=["BRENA","MACROLOTE_PARCIAL","LOTES_PARCIALES","MIXTO"].includes(condicion);
  if(requiereHabilitacion) add({
    codigo:"DM-01",nombre:"Habilitación del Predio",
    descripcion:"Programa maestro de actividades, estudios, trámites, gestiones, liberaciones y autorizaciones necesarias para llevar el predio hasta la licencia o liberación de urbanización.",
    tipo:"HABILITACION",obligatorio:true,moduloPrincipal:"Habilitación del predio",
    modulosDestino:["Programa","Documentación","Riesgos","Liberaciones","Costos"],periodicidadDefault:"SEMANAL"
  });

  add({codigo:"DM-02",nombre:"Estudios y Factibilidades",descripcion:"Control de estudios técnicos y factibilidades requeridas por el proyecto.",tipo:"ESTUDIOS",obligatorio:true,moduloPrincipal:"Estudios y factibilidades",modulosDestino:["Programa","Documentación","Riesgos","Liberaciones"],periodicidadDefault:"SEMANAL"});
  add({codigo:"DM-03",nombre:"Proyecto Ejecutivo",descripcion:"Desarrollo y liberación de disciplinas del proyecto ejecutivo.",tipo:"PROYECTO",obligatorio:true,moduloPrincipal:"Proyecto ejecutivo",modulosDestino:["Programa","Documentación","Calidad","Liberaciones"],periodicidadDefault:"SEMANAL"});
  add({codigo:"DM-04",nombre:"Permisos y Autorizaciones",descripcion:"Programa de trámites, permisos, licencias, dictámenes y autorizaciones.",tipo:"PERMISOS",obligatorio:true,moduloPrincipal:"Autorizaciones",modulosDestino:["Programa","Documentación","Riesgos","Liberaciones"],periodicidadDefault:"SEMANAL"});
  add({codigo:"DM-05",nombre:"Presupuesto y Costos",descripcion:"Presupuesto base, catálogo, precios unitarios, insumos, indirectos, contingencia y flujo económico.",tipo:"COSTOS",obligatorio:true,moduloPrincipal:"Presupuesto",modulosDestino:["Presupuesto","Costos","Flujo","Forecast"],periodicidadDefault:"SEMANAL"});
  add({codigo:"DM-06",nombre:"Programa Maestro de Obra",descripcion:"Programa general, hitos, ruta crítica, etapas, frentes y suministros.",tipo:"PROGRAMA",obligatorio:true,moduloPrincipal:"Programa",modulosDestino:["Programa","Avance","Alertas","Reportes"],periodicidadDefault:"SEMANAL"});

  const modalidades=Object.values(paquetes).map(v=>String(asObj(v).modalidad??""));
  if(modalidades.some(x=>x==="SUBCONTRATO"||x==="MIXTO")) add({codigo:"DM-07",nombre:"Contratación",descripcion:"Paquetes, alcances, contratos, anticipos, garantías, estimaciones y cierre contractual.",tipo:"CONTRATOS",obligatorio:true,moduloPrincipal:"Contratos",modulosDestino:["Contratos","Estimaciones","Pagos","Riesgos"],periodicidadDefault:"POR_ESTIMACION"});

  const suministros=Object.values(paquetes).map(v=>String(asObj(v).suministro??""));
  if(suministros.some(x=>x==="PROYECTO"||x==="MIXTO")) add({codigo:"DM-08",nombre:"Compras y Suministros",descripcion:"Programa de compras, requisiciones, órdenes, recepciones, consumos e inventarios.",tipo:"SUMINISTROS",obligatorio:true,moduloPrincipal:"Compras",modulosDestino:["Compras","Inventarios","Costos","Programa"],periodicidadDefault:"DIARIA"});

  const manoObra=Object.values(paquetes).map(v=>String(asObj(v).manoObra??""));
  if(manoObra.some(x=>x==="PROPIA"||x==="DESTAJO"||x==="MIXTA")) add({codigo:"DM-09",nombre:"Mano de Obra",descripcion:"Personal, cuadrillas, tabuladores, cargas sociales, provisiones, rendimiento y costo.",tipo:"MANO_OBRA",obligatorio:true,moduloPrincipal:"Mano de obra",modulosDestino:["Mano de obra","Costos","Productividad","Avance"],periodicidadDefault:"DIARIA"});

  const maquinaria=Object.values(paquetes).map(v=>String(asObj(v).maquinaria??""));
  if(maquinaria.some(x=>x==="PROPIA"||x==="RENTADA"||x==="MIXTA")) add({codigo:"DM-10",nombre:"Maquinaria y Equipo",descripcion:"Equipos, horas, renta, combustible, mantenimiento y rendimiento.",tipo:"MAQUINARIA",obligatorio:true,moduloPrincipal:"Maquinaria",modulosDestino:["Maquinaria","Costos","Productividad","Avance"],periodicidadDefault:"DIARIA"});

  if(requiereHabilitacion || Object.keys(servicios).length>0) add({codigo:"DM-11",nombre:"Urbanización",descripcion:"Programa y control de vialidades, redes, banquetas, guarniciones, alumbrado y obras exteriores.",tipo:"URBANIZACION",obligatorio:false,moduloPrincipal:"Urbanización",modulosDestino:["Programa","Avance","Costos","Calidad"],periodicidadDefault:"DIARIA"});
  if(Object.keys(servicios).length>0) add({codigo:"DM-12",nombre:"Infraestructura",descripcion:"Redes y sistemas de infraestructura requeridos por el proyecto.",tipo:"INFRAESTRUCTURA",obligatorio:false,moduloPrincipal:"Infraestructura",modulosDestino:["Programa","Avance","Costos","Calidad"],periodicidadDefault:"DIARIA"});
  if(obrasEspeciales.length>0) add({codigo:"DM-13",nombre:"Obras Especiales",descripcion:"PTAR, cárcamos, subestaciones, tanques, pozos y demás obras especiales detectadas.",tipo:"OBRAS_ESPECIALES",obligatorio:true,moduloPrincipal:"Obras especiales",modulosDestino:["Programa","Avance","Costos","Calidad","Riesgos"],periodicidadDefault:"SEMANAL"});

  if(Object.keys(proyectoEjecutivo).length>0 || asObj(c?.productoEscala).tipoProyecto) add({codigo:"DM-14",nombre:"Edificación",descripcion:"Estructura de control y programa de ejecución de vivienda, edificio, nave o componente edificable.",tipo:"EDIFICACION",obligatorio:true,moduloPrincipal:"Edificación",modulosDestino:["Programa","Avance","Costos","Productividad","Calidad"],periodicidadDefault:"DIARIA"});

  add({codigo:"DM-15",nombre:"Calidad",descripcion:"Inspecciones, pruebas, liberaciones, no conformidades y evidencias.",tipo:"CALIDAD",obligatorio:true,moduloPrincipal:"Calidad",modulosDestino:["Calidad","Liberaciones","Reportes"],periodicidadDefault:"POR_EVENTO"});
  add({codigo:"DM-16",nombre:"Seguridad",descripcion:"Recorridos, incidentes, observaciones, acciones correctivas y liberaciones de seguridad.",tipo:"SEGURIDAD",obligatorio:false,moduloPrincipal:"Seguridad",modulosDestino:["Seguridad","Alertas","Reportes"],periodicidadDefault:"DIARIA"});
  add({codigo:"DM-17",nombre:"Riesgos y Restricciones",descripcion:"Registro y seguimiento de riesgos, restricciones, responsables y respuestas.",tipo:"RIESGOS",obligatorio:true,moduloPrincipal:"Riesgos",modulosDestino:["Riesgos","Restricciones","Alertas","Reportes"],periodicidadDefault:"SEMANAL"});
  add({codigo:"DM-18",nombre:"Cambios y Extraordinarios",descripcion:"Solicitudes de cambio, impactos, autorizaciones y trazabilidad contra línea base.",tipo:"CAMBIOS",obligatorio:true,moduloPrincipal:"Cambios",modulosDestino:["Cambios","Presupuesto","Programa","Forecast"],periodicidadDefault:"POR_EVENTO"});
  if(modalidades.some(x=>x==="SUBCONTRATO"||x==="MIXTO")) add({codigo:"DM-19",nombre:"Estimaciones y Pagos",descripcion:"Estimaciones, avances contractuales, retenciones, pagos y saldos.",tipo:"ESTIMACIONES",obligatorio:true,moduloPrincipal:"Estimaciones",modulosDestino:["Estimaciones","Pagos","Costos","Contratos"],periodicidadDefault:"POR_ESTIMACION"});
  add({codigo:"DM-20",nombre:"Entrega y Cierre",descripcion:"Preentrega, pruebas finales, punch list, entrega, cierre técnico, contractual y financiero.",tipo:"CIERRE",obligatorio:true,moduloPrincipal:"Cierre",modulosDestino:["Entrega","Cierre","Documentación","Reportes"],periodicidadDefault:"POR_EVENTO"});

  return docs;
}

function actividadesDM01(){
  return [
    ["HT-001","Levantamiento topográfico","ESTUDIO","Predio","—","Topografía base","SEMANAL",true],
    ["HT-002","Mecánica de suelos","ESTUDIO","Predio","—","Informe geotécnico","SEMANAL",true],
    ["HT-003","Validación jurídica y documental del predio","GESTION","Predio","—","Expediente jurídico validado","SEMANAL",true],
    ["HT-004","Dictamen / compatibilidad de uso de suelo","TRAMITE","Urbanístico","HT-003","Dictamen de uso de suelo","SEMANAL",true],
    ["HT-005","Factibilidad de agua potable","GESTION","Servicios","HT-001","Factibilidad de agua","SEMANAL",true],
    ["HT-006","Factibilidad de drenaje sanitario","GESTION","Servicios","HT-001","Factibilidad de drenaje","SEMANAL",true],
    ["HT-007","Factibilidad eléctrica","GESTION","Servicios","HT-001","Factibilidad eléctrica","SEMANAL",true],
    ["HT-008","Estudio / solución pluvial","ESTUDIO","Servicios","HT-001","Criterio o proyecto pluvial","SEMANAL",false],
    ["HT-009","Proyecto preliminar de urbanización","PROYECTO","Proyecto","HT-004","Anteproyecto de urbanización","SEMANAL",true],
    ["HT-010","Proyecto ejecutivo de urbanización","PROYECTO","Proyecto","HT-005,HT-006,HT-007,HT-009","Proyecto ejecutivo","SEMANAL",true],
    ["HT-011","Integración de expediente para licencia","GESTION","Autorizaciones","HT-010","Expediente de trámite","SEMANAL",true],
    ["HT-012","Ingreso de trámite de licencia de urbanización","TRAMITE","Autorizaciones","HT-011","Acuse de ingreso","SEMANAL",true],
    ["HT-013","Atención de observaciones de autoridad","GESTION","Autorizaciones","HT-012","Observaciones solventadas","SEMANAL",true],
    ["HT-014","Pago de derechos y garantías","TRAMITE","Autorizaciones","HT-013","Recibos / garantías","POR_EVENTO",true],
    ["HT-015","Obtención de licencia de urbanización","HITO","Autorizaciones","HT-014","Licencia de urbanización","POR_EVENTO",true],
  ];
}

export async function generarDocumentosMaestros(formData:FormData){
  const codigo=clean(formData.get("codigo")).toUpperCase();
  if(!codigo) return;
  const {proyecto}=await requireProjectWriteAccess(codigo);
  const c=await prisma.constructibilidadPM.findUnique({where:{proyectoId:proyecto.id}});
  if(!c) redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/constructibilidad?error=sin_constructibilidad`);

  const docs=buildDocs(c);
  for(const d of docs){
    const doc=await prisma.documentoMaestroPM.upsert({
      where:{proyectoId_codigo:{proyectoId:proyecto.id,codigo:d.codigo}},
      create:{
        proyectoId:proyecto.id,codigo:d.codigo,nombre:d.nombre,descripcion:d.descripcion,tipo:d.tipo,
        obligatorio:d.obligatorio,moduloPrincipal:d.moduloPrincipal,modulosDestino:json(d.modulosDestino),
        periodicidadDefault:d.periodicidadDefault,reglasConfiguracion:json({generadoDesde:"Constructibilidad"})
      },
      update:{
        nombre:d.nombre,descripcion:d.descripcion,tipo:d.tipo,obligatorio:d.obligatorio,activo:true,
        moduloPrincipal:d.moduloPrincipal,modulosDestino:json(d.modulosDestino),
        periodicidadDefault:d.periodicidadDefault,reglasConfiguracion:json({generadoDesde:"Constructibilidad"})
      }
    });

    if(d.codigo==="DM-01"){
      for(const [codigoAct,actividad,tipo,etapa,dependencia,entregable,periodicidad,bloqueante] of actividadesDM01()){
        await prisma.actividadDocumentoMaestroPM.upsert({
          where:{documentoMaestroId_codigo:{documentoMaestroId:doc.id,codigo:String(codigoAct)}},
          create:{
            documentoMaestroId:doc.id,codigo:String(codigoAct),actividad:String(actividad),tipo:String(tipo),
            etapa:String(etapa),dependencia:String(dependencia),entregable:String(entregable),
            periodicidad:String(periodicidad),bloqueante:Boolean(bloqueante),
            modulosDestino:json(["Programa","Documentación","Riesgos","Liberaciones","Costos"]),
            origen:"AUTOMATICO"
          },
          update:{
            actividad:String(actividad),tipo:String(tipo),etapa:String(etapa),dependencia:String(dependencia),
            entregable:String(entregable),periodicidad:String(periodicidad),bloqueante:Boolean(bloqueante)
          }
        });
      }
    }
  }

  await prisma.documentoMaestroPM.updateMany({
    where:{proyectoId:proyecto.id,codigo:{notIn:docs.map(d=>d.codigo)}},
    data:{activo:false}
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/documentos-maestros`);
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}`);
  redirect(`/project-manager/panel/proyectos/${codigo.toLowerCase()}/documentos-maestros?generados=1`);
}

export async function agregarActividadManual(formData:FormData){
  const codigoProyecto=clean(formData.get("codigoProyecto")).toUpperCase();
  const documentoId=clean(formData.get("documentoId"));
  if(!codigoProyecto||!documentoId) return;
  const {proyecto}=await requireProjectWriteAccess(codigoProyecto);

  const doc=await prisma.documentoMaestroPM.findFirst({where:{id:documentoId,proyectoId:proyecto.id}});
  if(!doc) return;

  const count=await prisma.actividadDocumentoMaestroPM.count({where:{documentoMaestroId:doc.id}});
  const prefix=doc.codigo.replace("DM-","");
  const codigoAct=clean(formData.get("codigoActividad")) || `${prefix}-M${String(count+1).padStart(3,"0")}`;

  await prisma.actividadDocumentoMaestroPM.create({
    data:{
      documentoMaestroId:doc.id,
      codigo:codigoAct,
      actividad:clean(formData.get("actividad"))||"Actividad manual",
      descripcion:clean(formData.get("descripcion"))||null,
      tipo:clean(formData.get("tipo"))||"ACTIVIDAD",
      responsable:clean(formData.get("responsable"))||null,
      organismo:clean(formData.get("organismo"))||null,
      fechaInicioPlan:clean(formData.get("fechaInicioPlan"))?new Date(clean(formData.get("fechaInicioPlan"))):null,
      fechaFinPlan:clean(formData.get("fechaFinPlan"))?new Date(clean(formData.get("fechaFinPlan"))):null,
      estado:"PENDIENTE",
      prioridad:clean(formData.get("prioridad"))||"MEDIA",
      entregable:clean(formData.get("entregable"))||null,
      bloqueante:formData.get("bloqueante")==="on",
      periodicidad:clean(formData.get("periodicidad"))||doc.periodicidadDefault,
      reglaAlerta:clean(formData.get("reglaAlerta"))||null,
      modulosDestino:doc.modulosDestino??undefined,
      origen:"MANUAL"
    }
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigoProyecto.toLowerCase()}/documentos-maestros/${doc.codigo.toLowerCase()}`);
  redirect(`/project-manager/panel/proyectos/${codigoProyecto.toLowerCase()}/documentos-maestros/${doc.codigo.toLowerCase()}?agregada=1`);
}
