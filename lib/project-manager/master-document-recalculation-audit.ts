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


export async function saveMasterDocumentRecalculationAudit(args:{
  proyectoId:string;
  userId:string;
  constructibilidad:unknown;
  motivo:string;
  nuevaVersion:number;
  preview:unknown;
  lineaBase:{estado:string;version:number}|null;
  posteriorLineaBase:boolean;
}){
  return prisma.recalculoDocumentoMaestroPM.create({
    data:{
      proyectoId:args.proyectoId,
      version:args.nuevaVersion,
      motivo:args.motivo||"Ajuste de configuración previo a Línea Base",
      resumen:JSON.parse(JSON.stringify(args.preview)),
      constructibilidadSnapshot:JSON.parse(JSON.stringify(args.constructibilidad)),
      lineaBaseEstado:args.lineaBase?.estado??null,
      lineaBaseVersion:args.lineaBase?.version??null,
      posteriorLineaBase:args.posteriorLineaBase,
      aplicadoPorId:args.userId
    }
  });
}
