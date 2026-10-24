import { prisma } from "@/lib/prisma";
import { buildRecalculationPreview } from "@/lib/project-manager/master-document-recalculation";

export async function prepareMasterDocumentRecalculationAudit(proyectoId:string,constructibilidad:unknown,motivo:string){
  const lineaBase=await prisma.lineaBasePM.findUnique({where:{proyectoId}});
  const posteriorLineaBase=lineaBase?.estado==="APROBADA";
  const existentes=await prisma.documentoMaestroPM.findMany({
    where:{proyectoId},
    include:{actividades:true}
  });
  const preview=buildRecalculationPreview(constructibilidad,existentes);
  const ultimaVersion=await prisma.recalculoDocumentoMaestroPM.aggregate({
    where:{proyectoId},
    _max:{version:true}
  });
  return {
    lineaBase,
    posteriorLineaBase,
    motivo:motivo.trim(),
    preview,
    nuevaVersion:(ultimaVersion._max.version??0)+1
  };
}
