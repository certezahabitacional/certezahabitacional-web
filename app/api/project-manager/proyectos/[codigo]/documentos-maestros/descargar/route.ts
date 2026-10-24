import JSZip from "jszip";
import { NextResponse } from "next/server";
import { getProjectDownloadAccess } from "@/lib/project-manager/download-access";
import { activityCsv, constructibilidadSummaryCsv, safeFileName } from "@/lib/project-manager/master-document-export";
import { buildMasterDocumentDefinitions, actividadesBaseDM01 } from "@/lib/project-manager/master-document-definitions";

export const runtime="nodejs";

export async function GET(_:Request,{params}:{params:Promise<{codigo:string}>}){
  const {codigo}=await params;
  const access=await getProjectDownloadAccess(codigo);
  if(!access) return NextResponse.json({error:"No autorizado"},{status:401});
  const c=access.proyecto.constructibilidad;
  if(!c) return NextResponse.json({error:"El proyecto no tiene Constructibilidad configurada."},{status:409});

  const defs=buildMasterDocumentDefinitions(c);
  const existing=new Map(access.proyecto.documentosMaestros.map(d=>[d.codigo,d]));
  const zip=new JSZip();
  const folder=zip.folder("Documentos_Maestros");
  if(!folder) return NextResponse.json({error:"No fue posible generar el paquete."},{status:500});

  const summaryDocs=defs.map(d=>({
    codigo:d.codigo,nombre:d.nombre,periodicidadDefault:d.periodicidadDefault,
    moduloPrincipal:d.moduloPrincipal,modulosDestino:d.modulosDestino
  }));
  folder.file("00_Resumen_Constructibilidad.csv",constructibilidadSummaryCsv(
    {codigo:access.proyecto.codigo,nombre:access.proyecto.nombre},
    c as unknown as Record<string,unknown>,
    summaryDocs
  ));

  const readme=[
    "CERTEZA PROJECT MANAGER - DOCUMENTOS MAESTROS",
    "",
    `Proyecto: ${access.proyecto.codigo} - ${access.proyecto.nombre}`,
    `Generado: ${new Date().toISOString()}`,
    "",
    "Este paquete se genera con base en la Constructibilidad vigente del proyecto.",
    "Incluye únicamente los Documentos Maestros que aplican según esa configuración.",
    "Los archivos CSV pueden abrirse y editarse en Excel y conservan el formato compatible con la importación de CPM.",
    "Las actividades pueden complementarse manualmente dentro de CPM o en el archivo antes de reimportarlo.",
    "",
    "Regla: si cambia la Constructibilidad, vuelve a generar/descargar los Documentos Maestros para obtener la nueva configuración."
  ].join("\r\n");
  folder.file("LEEME.txt",readme);

  for(const def of defs){
    const doc=existing.get(def.codigo);
    let rows: Parameters<typeof activityCsv>[0]=doc?.actividades??[];
    if(!rows.length&&def.codigo==="DM-01"){
      rows=actividadesBaseDM01().map(([codigoAct,actividad,tipo,etapa,dependencia,entregable,periodicidad,bloqueante])=>({
        codigo:String(codigoAct),actividad:String(actividad),descripcion:null,tipo:String(tipo),etapa:String(etapa),
        dependencia:String(dependencia),responsable:null,organismo:null,fechaInicioPlan:null,fechaFinPlan:null,
        entregable:String(entregable),periodicidad:String(periodicidad),bloqueante:Boolean(bloqueante),
        prioridad:"MEDIA",reglaAlerta:null,estado:"PENDIENTE"
      }));
    }
    const name=safeFileName(`${def.codigo}_${def.nombre}.csv`);
    folder.file(name,activityCsv(rows));
  }

  const bytes=await zip.generateAsync({type:"uint8array",compression:"DEFLATE",compressionOptions:{level:6}});
  const filename=safeFileName(`${access.proyecto.codigo}_Documentos_Maestros_CPM.zip`);
  return new NextResponse(bytes,{
    status:200,
    headers:{
      "content-type":"application/zip",
      "content-disposition":`attachment; filename="${filename}"`,
      "cache-control":"private, no-store"
    }
  });
}
