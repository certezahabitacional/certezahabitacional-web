import { NextResponse } from "next/server";
import { getProjectDownloadAccess } from "@/lib/project-manager/download-access";
import { activityCsv, safeFileName } from "@/lib/project-manager/master-document-export";
import { buildMasterDocumentDefinitions, actividadesBaseDM01 } from "@/lib/project-manager/master-document-definitions";

export async function GET(_:Request,{params}:{params:Promise<{codigo:string;documento:string}>}){
  const {codigo,documento}=await params;
  const access=await getProjectDownloadAccess(codigo);
  if(!access) return NextResponse.json({error:"No autorizado"},{status:401});
  const c=access.proyecto.constructibilidad;
  if(!c) return NextResponse.json({error:"El proyecto no tiene Constructibilidad configurada."},{status:409});

  const defs=buildMasterDocumentDefinitions(c);
  const docCode=documento.toUpperCase();
  const def=defs.find(d=>d.codigo===docCode);
  if(!def) return NextResponse.json({error:"Este Documento Maestro no aplica según la Constructibilidad vigente."},{status:404});

  const existing=access.proyecto.documentosMaestros.find(d=>d.codigo===docCode);
  let rows=existing?.actividades??[];
  if(!rows.length&&docCode==="DM-01"){
    rows=actividadesBaseDM01().map(([codigoAct,actividad,tipo,etapa,dependencia,entregable,periodicidad,bloqueante])=>({
      codigo:String(codigoAct),actividad:String(actividad),descripcion:null,tipo:String(tipo),etapa:String(etapa),
      dependencia:String(dependencia),responsable:null,organismo:null,fechaInicioPlan:null,fechaFinPlan:null,
      entregable:String(entregable),periodicidad:String(periodicidad),bloqueante:Boolean(bloqueante),
      prioridad:"MEDIA",reglaAlerta:null,estado:"PENDIENTE"
    }));
  }

  const csv=activityCsv(rows);
  const filename=safeFileName(`${access.proyecto.codigo}_${def.codigo}_${def.nombre}.csv`);
  return new NextResponse(csv,{
    status:200,
    headers:{
      "content-type":"text/csv; charset=utf-8",
      "content-disposition":`attachment; filename="${filename}"`,
      "cache-control":"private, no-store"
    }
  });
}
