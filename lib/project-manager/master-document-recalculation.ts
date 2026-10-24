import { buildMasterDocumentDefinitions, actividadesBaseDM01 } from "@/lib/project-manager/master-document-definitions";
import { buildMasterDocumentActivities } from "@/lib/project-manager/master-document-activities";

type ExistingActivity={
  codigo:string;
  actividad:string;
  tipo:string|null;
  etapa:string|null;
  dependencia:string|null;
  responsable:string|null;
  organismo:string|null;
  periodicidad:string|null;
  bloqueante:boolean;
  prioridad:string;
  estado:string;
  fechaInicioReal:Date|null;
  fechaFinReal:Date|null;
  evidenciaUrl:string|null;
  costoReal:unknown;
  notas:string|null;
  origen:string;
};

type ExistingDoc={
  codigo:string;
  nombre:string;
  activo:boolean;
  actividades:ExistingActivity[];
};

export type RecalculationPreview={
  documentosNuevos:string[];
  documentosReactivados:string[];
  documentosDesactivados:string[];
  documentosSinCambio:string[];
  actividadesNuevas:{documento:string;codigo:string;actividad:string}[];
  actividadesModificadas:{documento:string;codigo:string;actividad:string;cambios:string[]}[];
  actividadesObsoletasEliminables:{documento:string;codigo:string;actividad:string}[];
  actividadesObsoletasProtegidas:{documento:string;codigo:string;actividad:string;motivo:string}[];
  manualesConservadas:{documento:string;codigo:string;actividad:string}[];
  resumen:{
    documentosAplicables:number;
    actividadesEsperadas:number;
    cambiosTotales:number;
    protegidas:number;
  };
};

function expectedActivities(c:any,docCode:string){
  if(docCode==="DM-01"){
    return actividadesBaseDM01().map(([codigoAct,actividad,tipo,etapa,dependencia,entregable,periodicidad,bloqueante])=>({
      codigo:String(codigoAct),actividad:String(actividad),tipo:String(tipo),etapa:String(etapa),
      dependencia:String(dependencia),responsable:null,organismo:null,
      entregable:String(entregable),periodicidad:String(periodicidad),
      bloqueante:Boolean(bloqueante),prioridad:"MEDIA"
    }));
  }
  return buildMasterDocumentActivities(c,docCode).map(a=>({
    codigo:a.codigo,actividad:a.actividad,tipo:a.tipo,etapa:a.etapa,
    dependencia:a.dependencia??null,responsable:a.responsable??null,organismo:a.organismo??null,
    entregable:a.entregable,periodicidad:a.periodicidad,bloqueante:a.bloqueante,prioridad:a.prioridad
  }));
}

function hasExecution(a:ExistingActivity){
  return a.estado!=="PENDIENTE" || !!a.fechaInicioReal || !!a.fechaFinReal || !!a.evidenciaUrl ||
    Number(a.costoReal||0)!==0 || !!a.notas;
}

export function buildRecalculationPreview(c:any,existingDocs:ExistingDoc[]):RecalculationPreview{
  const defs=buildMasterDocumentDefinitions(c);
  const expectedCodes=new Set(defs.map(d=>d.codigo));
  const existingMap=new Map(existingDocs.map(d=>[d.codigo,d]));

  const documentosNuevos:string[]=[];
  const documentosReactivados:string[]=[];
  const documentosDesactivados:string[]=[];
  const documentosSinCambio:string[]=[];
  const actividadesNuevas:RecalculationPreview["actividadesNuevas"]=[];
  const actividadesModificadas:RecalculationPreview["actividadesModificadas"]=[];
  const actividadesObsoletasEliminables:RecalculationPreview["actividadesObsoletasEliminables"]=[];
  const actividadesObsoletasProtegidas:RecalculationPreview["actividadesObsoletasProtegidas"]=[];
  const manualesConservadas:RecalculationPreview["manualesConservadas"]=[];

  let expectedCount=0;

  for(const def of defs){
    const oldDoc=existingMap.get(def.codigo);
    if(!oldDoc) documentosNuevos.push(def.codigo);
    else if(!oldDoc.activo) documentosReactivados.push(def.codigo);
    else documentosSinCambio.push(def.codigo);

    const expected=expectedActivities(c,def.codigo);
    expectedCount+=expected.length;
    const oldActs=new Map((oldDoc?.actividades??[]).map(a=>[a.codigo,a]));

    for(const exp of expected){
      const old=oldActs.get(exp.codigo);
      if(!old){
        actividadesNuevas.push({documento:def.codigo,codigo:exp.codigo,actividad:exp.actividad});
        continue;
      }
      if(old.origen!=="AUTOMATICO") continue;
      const cambios:string[]=[];
      if(old.actividad!==exp.actividad) cambios.push("actividad");
      if((old.tipo??"")!==exp.tipo) cambios.push("tipo");
      if((old.etapa??"")!==exp.etapa) cambios.push("etapa");
      if((old.dependencia??"")!==(exp.dependencia??"")) cambios.push("dependencia");
      if((old.responsable??"")!==(exp.responsable??"")) cambios.push("responsable");
      if((old.organismo??"")!==(exp.organismo??"")) cambios.push("organismo");
      if((old.periodicidad??"")!==exp.periodicidad) cambios.push("periodicidad");
      if(old.bloqueante!==exp.bloqueante) cambios.push("bloqueante");
      if(old.prioridad!==exp.prioridad) cambios.push("prioridad");
      if(cambios.length) actividadesModificadas.push({documento:def.codigo,codigo:exp.codigo,actividad:exp.actividad,cambios});
    }

    const expectedSet=new Set(expected.map(a=>a.codigo));
    for(const old of oldDoc?.actividades??[]){
      if(old.origen==="MANUAL"||old.origen==="IMPORTADO"){
        manualesConservadas.push({documento:def.codigo,codigo:old.codigo,actividad:old.actividad});
        continue;
      }
      if(old.origen==="AUTOMATICO"&&!expectedSet.has(old.codigo)){
        if(hasExecution(old)){
          actividadesObsoletasProtegidas.push({
            documento:def.codigo,codigo:old.codigo,actividad:old.actividad,
            motivo:"Tiene ejecución, estado, evidencia, costo real o notas; no se eliminará."
          });
        }else{
          actividadesObsoletasEliminables.push({documento:def.codigo,codigo:old.codigo,actividad:old.actividad});
        }
      }
    }
  }

  for(const d of existingDocs){
    if(d.activo&&!expectedCodes.has(d.codigo)) documentosDesactivados.push(d.codigo);
  }

  const cambiosTotales=documentosNuevos.length+documentosReactivados.length+documentosDesactivados.length+
    actividadesNuevas.length+actividadesModificadas.length+actividadesObsoletasEliminables.length;

  return {
    documentosNuevos,documentosReactivados,documentosDesactivados,documentosSinCambio,
    actividadesNuevas,actividadesModificadas,actividadesObsoletasEliminables,actividadesObsoletasProtegidas,
    manualesConservadas,
    resumen:{
      documentosAplicables:defs.length,
      actividadesEsperadas:expectedCount,
      cambiosTotales,
      protegidas:actividadesObsoletasProtegidas.length
    }
  };
}
