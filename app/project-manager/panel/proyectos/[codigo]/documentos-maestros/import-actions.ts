"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";

const clean=(v:unknown)=>String(v??"").trim();
const json=(v:unknown)=>JSON.parse(JSON.stringify(v??null)) as Prisma.InputJsonValue;

export type ImportRow={
  codigo:string;
  actividad:string;
  descripcion:string;
  tipo:string;
  etapa:string;
  dependencia:string;
  responsable:string;
  organismo:string;
  fechaInicioPlan:string;
  fechaFinPlan:string;
  entregable:string;
  periodicidad:string;
  bloqueante:boolean;
  prioridad:string;
  reglaAlerta:string;
  estado:string;
};

export type ImportPreview={
  ok:boolean;
  error?:string;
  documentoId?:string;
  codigoProyecto?:string;
  nuevas?:ImportRow[];
  modificadas?:ImportRow[];
  sinCambio?:ImportRow[];
  posiblesBajas?:{codigo:string;actividad:string}[];
};

function parseCsvLine(line:string){
  const out:string[]=[];
  let cur="";
  let quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted && line[i+1]==='"'){cur+='"';i++;}
      else quoted=!quoted;
    } else if(ch==="," && !quoted){
      out.push(cur);cur="";
    } else cur+=ch;
  }
  out.push(cur);
  return out.map(v=>v.trim());
}

function normalizeHeader(v:string){
  return v.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"");
}

function bool(v:string){
  return ["si","sí","true","1","x","yes"].includes(v.trim().toLowerCase());
}

function normalizeDate(v:string){
  const s=v.trim();
  if(!s) return "";
  const iso=/^\d{4}-\d{2}-\d{2}$/;
  if(iso.test(s)) return s;
  const m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  return s;
}

function parseCsv(text:string):ImportRow[]{
  const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim());
  if(lines.length<2) return [];
  const headers=parseCsvLine(lines[0]).map(normalizeHeader);
  const idx=(...keys:string[])=>{
    for(const k of keys){
      const i=headers.indexOf(normalizeHeader(k));
      if(i>=0) return i;
    }
    return -1;
  };
  const get=(cells:string[],...keys:string[])=>{
    const i=idx(...keys); return i>=0?clean(cells[i]):"";
  };

  return lines.slice(1).map(line=>{
    const c=parseCsvLine(line);
    return {
      codigo:get(c,"codigo","id"),
      actividad:get(c,"actividad","nombre","tarea"),
      descripcion:get(c,"descripcion"),
      tipo:get(c,"tipo"),
      etapa:get(c,"etapa"),
      dependencia:get(c,"dependencia","predecesora","predecesoras"),
      responsable:get(c,"responsable"),
      organismo:get(c,"organismo","autoridad"),
      fechaInicioPlan:normalizeDate(get(c,"fechainicioplan","inicio","fechainicio")),
      fechaFinPlan:normalizeDate(get(c,"fechafinplan","fin","fechafin")),
      entregable:get(c,"entregable"),
      periodicidad:get(c,"periodicidad","seguimiento"),
      bloqueante:bool(get(c,"bloqueante")),
      prioridad:get(c,"prioridad")||"MEDIA",
      reglaAlerta:get(c,"reglaalerta","alerta"),
      estado:get(c,"estado")||"PENDIENTE",
    };
  }).filter(r=>r.codigo&&r.actividad);
}

function comparable(r:ImportRow){
  return JSON.stringify({
    actividad:r.actividad,descripcion:r.descripcion,tipo:r.tipo,etapa:r.etapa,
    dependencia:r.dependencia,responsable:r.responsable,organismo:r.organismo,
    fechaInicioPlan:r.fechaInicioPlan,fechaFinPlan:r.fechaFinPlan,
    entregable:r.entregable,periodicidad:r.periodicidad,bloqueante:r.bloqueante,
    prioridad:r.prioridad,reglaAlerta:r.reglaAlerta,estado:r.estado
  });
}

export async function previsualizarImportacionDocumentoMaestro(_:ImportPreview,formData:FormData):Promise<ImportPreview>{
  const codigoProyecto=clean(formData.get("codigoProyecto")).toUpperCase();
  const documentoId=clean(formData.get("documentoId"));
  const archivo=formData.get("archivo");

  if(!codigoProyecto||!documentoId||!(archivo instanceof File)) return {ok:false,error:"Falta seleccionar el archivo."};
  if(!archivo.name.toLowerCase().endsWith(".csv")) return {ok:false,error:"Por ahora importa un archivo CSV compatible con Excel."};

  const {proyecto}=await requireProjectWriteAccess(codigoProyecto);
  const doc=await prisma.documentoMaestroPM.findFirst({
    where:{id:documentoId,proyectoId:proyecto.id},
    include:{actividades:true}
  });
  if(!doc) return {ok:false,error:"Documento Maestro no encontrado."};

  const rows=parseCsv(await archivo.text());
  if(!rows.length) return {ok:false,error:"El archivo no contiene actividades válidas. Debe incluir como mínimo Código y Actividad."};

  const existing=new Map(doc.actividades.map(a=>[a.codigo,{
    codigo:a.codigo,
    actividad:a.actividad,
    descripcion:a.descripcion??"",
    tipo:a.tipo??"",
    etapa:a.etapa??"",
    dependencia:a.dependencia??"",
    responsable:a.responsable??"",
    organismo:a.organismo??"",
    fechaInicioPlan:a.fechaInicioPlan?.toISOString().slice(0,10)??"",
    fechaFinPlan:a.fechaFinPlan?.toISOString().slice(0,10)??"",
    entregable:a.entregable??"",
    periodicidad:a.periodicidad??"",
    bloqueante:a.bloqueante,
    prioridad:a.prioridad,
    reglaAlerta:a.reglaAlerta??"",
    estado:a.estado,
  } satisfies ImportRow]));

  const nuevas:ImportRow[]=[];
  const modificadas:ImportRow[]=[];
  const sinCambio:ImportRow[]=[];
  for(const row of rows){
    const old=existing.get(row.codigo);
    if(!old) nuevas.push(row);
    else if(comparable(old)!==comparable(row)) modificadas.push(row);
    else sinCambio.push(row);
  }

  const incoming=new Set(rows.map(r=>r.codigo));
  const posiblesBajas=doc.actividades
    .filter(a=>!incoming.has(a.codigo))
    .map(a=>({codigo:a.codigo,actividad:a.actividad}));

  return {ok:true,documentoId,codigoProyecto,nuevas,modificadas,sinCambio,posiblesBajas};
}

export async function aplicarImportacionDocumentoMaestro(formData:FormData){
  const codigoProyecto=clean(formData.get("codigoProyecto")).toUpperCase();
  const documentoId=clean(formData.get("documentoId"));
  const payload=clean(formData.get("payload"));
  if(!codigoProyecto||!documentoId||!payload) return;

  const {proyecto}=await requireProjectWriteAccess(codigoProyecto);
  const doc=await prisma.documentoMaestroPM.findFirst({where:{id:documentoId,proyectoId:proyecto.id}});
  if(!doc) return;

  let parsed:{nuevas?:ImportRow[];modificadas?:ImportRow[]};
  try{parsed=JSON.parse(payload);}catch{return;}
  const rows=[...(parsed.nuevas??[]),...(parsed.modificadas??[])].slice(0,2000);

  for(const r of rows){
    if(!r.codigo||!r.actividad) continue;
    const data={
      actividad:clean(r.actividad),
      descripcion:clean(r.descripcion)||null,
      tipo:clean(r.tipo)||null,
      etapa:clean(r.etapa)||null,
      dependencia:clean(r.dependencia)||null,
      responsable:clean(r.responsable)||null,
      organismo:clean(r.organismo)||null,
      fechaInicioPlan:r.fechaInicioPlan?new Date(r.fechaInicioPlan):null,
      fechaFinPlan:r.fechaFinPlan?new Date(r.fechaFinPlan):null,
      entregable:clean(r.entregable)||null,
      periodicidad:clean(r.periodicidad)||doc.periodicidadDefault,
      bloqueante:Boolean(r.bloqueante),
      prioridad:clean(r.prioridad)||"MEDIA",
      reglaAlerta:clean(r.reglaAlerta)||null,
      estado:clean(r.estado)||"PENDIENTE",
      modulosDestino:doc.modulosDestino??json([]),
      origen:"IMPORTADO",
    };
    await prisma.actividadDocumentoMaestroPM.upsert({
      where:{documentoMaestroId_codigo:{documentoMaestroId:doc.id,codigo:clean(r.codigo)}},
      create:{documentoMaestroId:doc.id,codigo:clean(r.codigo),...data},
      update:data,
    });
  }

  await prisma.documentoMaestroPM.update({
    where:{id:doc.id},
    data:{estado:"EN_PROCESO",version:{increment:1},archivoReferenciaNombre:"CSV importado"}
  });

  revalidatePath(`/project-manager/panel/proyectos/${codigoProyecto.toLowerCase()}/documentos-maestros/${doc.codigo.toLowerCase()}`);
}
