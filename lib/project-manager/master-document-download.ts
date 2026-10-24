import { actividadesBaseDM01 } from "@/lib/project-manager/master-document-definitions";
import { buildMasterDocumentActivities } from "@/lib/project-manager/master-document-activities";
import type { activityCsv } from "@/lib/project-manager/master-document-export";

type CsvRows=Parameters<typeof activityCsv>[0];
type ExistingDoc={codigo:string;actividades:CsvRows};

function dateOrNull(v?:string){return v?new Date(v):null;}

export function buildDownloadRows(c:any,docCode:string,existing?:ExistingDoc):CsvRows{
  const templates=docCode==="DM-01"
    ? actividadesBaseDM01().map(([codigoAct,actividad,tipo,etapa,dependencia,entregable,periodicidad,bloqueante])=>({
        codigo:String(codigoAct),actividad:String(actividad),descripcion:null,tipo:String(tipo),etapa:String(etapa),
        dependencia:String(dependencia),responsable:null,organismo:null,fechaInicioPlan:null,fechaFinPlan:null,
        entregable:String(entregable),periodicidad:String(periodicidad),bloqueante:Boolean(bloqueante),
        prioridad:"MEDIA",reglaAlerta:null,estado:"PENDIENTE"
      }))
    : buildMasterDocumentActivities(c,docCode).map(a=>({
        codigo:a.codigo,actividad:a.actividad,descripcion:a.descripcion??null,tipo:a.tipo,etapa:a.etapa,
        dependencia:a.dependencia??null,responsable:a.responsable??null,organismo:a.organismo??null,
        fechaInicioPlan:dateOrNull(a.fechaInicioPlan),fechaFinPlan:dateOrNull(a.fechaFinPlan),
        entregable:a.entregable,periodicidad:a.periodicidad,bloqueante:a.bloqueante,prioridad:a.prioridad,
        reglaAlerta:a.reglaAlerta??null,estado:"PENDIENTE"
      }));

  const current=new Map((existing?.actividades??[]).map(a=>[a.codigo,a]));
  const rows:CsvRows=[];

  for(const t of templates){
    const old=current.get(t.codigo);
    rows.push(old?{
      ...t,
      ...old,
      actividad:t.actividad,
      descripcion:t.descripcion,
      tipo:t.tipo,
      etapa:t.etapa,
      dependencia:t.dependencia,
      responsable:old.responsable||t.responsable,
      organismo:old.organismo||t.organismo,
      fechaInicioPlan:old.fechaInicioPlan??t.fechaInicioPlan,
      fechaFinPlan:old.fechaFinPlan??t.fechaFinPlan,
      entregable:t.entregable,
      periodicidad:t.periodicidad,
      bloqueante:t.bloqueante,
      prioridad:t.prioridad,
      reglaAlerta:t.reglaAlerta
    }:t);
  }

  for(const a of existing?.actividades??[]){
    if(a.origen==="MANUAL"||a.origen==="IMPORTADO"){
      if(!rows.some(r=>r.codigo===a.codigo)) rows.push(a);
    }
  }
  return rows;
}
