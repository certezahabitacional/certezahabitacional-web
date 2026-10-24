import { NextResponse } from "next/server";
import { getProjectDownloadAccess } from "@/lib/project-manager/download-access";
import { activityCsv, safeFileName } from "@/lib/project-manager/master-document-export";
import { buildMasterDocumentDefinitions } from "@/lib/project-manager/master-document-definitions";
import { buildDownloadRows } from "@/lib/project-manager/master-document-download";

export async function GET(_:Request,{params}:{params:Promise<{codigo:string;documento:string}>}){
  const {codigo,documento}=await params;
  const access=await getProjectDownloadAccess(codigo);
  if(!access) return NextResponse.json({error:"No autorizado"},{status:401});
  const c=access.proyecto.constructibilidad;
  if(!c) return NextResponse.redirect(new URL(`/project-manager/panel/proyectos/${codigo}/documentos-maestros?error=sin_constructibilidad`,_.url));

  const defs=buildMasterDocumentDefinitions(c);
  const docCode=documento.toUpperCase();
  const def=defs.find(d=>d.codigo===docCode);
  if(!def) return NextResponse.json({error:"Este Documento Maestro no aplica según la Constructibilidad vigente."},{status:404});

  const existing=access.proyecto.documentosMaestros.find(d=>d.codigo===docCode);
  const rows=buildDownloadRows(c,docCode,existing?{codigo:existing.codigo,actividades:existing.actividades}:undefined);

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
