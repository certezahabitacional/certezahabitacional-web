import { obtenerPlanConfirmado } from "@/lib/recorrido-plan-confirmado";
import { EstadoInspeccion } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

type PasoCritico = {
  clave: string;
  estado: string;
  orden: number;
  lecturaInicial: string | null;
  lecturaFinal: string | null;
  pruebaProlongada: boolean;
  pendientesNormales: number;
};

export default async function FlujoV1Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: { id: true, estado: true, numeroInspeccion: true },
  });

  if (!inspeccion) notFound();

  if (inspeccion.estado === EstadoInspeccion.PROGRAMADA) {
    redirect(`/panel/inspecciones/${id}/revision-inicial`);
  }

  if (inspeccion.numeroInspeccion !== 1) {
    redirect(`/panel/inspecciones/${id}/captura`);
  }

  const [control] = await prisma.$queryRaw<Array<{
    proyectoConfirmado: boolean;
    areasConfirmadas: boolean;
    inspeccionTecnicaConcluidaEn: Date | null;
    preReporteGeneradoEn: Date | null;
    campoFinalizadoEn: Date | null;
    revisionInspectorFinalEn: Date | null;
  }>>`
    SELECT "proyectoConfirmado","areasConfirmadas","inspeccionTecnicaConcluidaEn","preReporteGeneradoEn","campoFinalizadoEn","revisionInspectorFinalEn"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${id}
    LIMIT 1
  `;

  if (control?.revisionInspectorFinalEn || control?.campoFinalizadoEn) {
    redirect(`/panel/inspecciones/${id}/cierre-v1`);
  }
  if (control?.preReporteGeneradoEn) {
    redirect(`/panel/inspecciones/${id}/revision-final-inspector`);
  }
  if (control?.inspeccionTecnicaConcluidaEn) {
    redirect(`/panel/inspecciones/${id}/reporte-v1`);
  }

  if (await obtenerPlanConfirmado(id)) redirect(`/panel/inspecciones/${id}/campo-v1`);

  if (!control?.proyectoConfirmado) {
    redirect(`/panel/inspecciones/${id}/proyecto-v1`);
  }

  const pasos = await prisma.$queryRaw<PasoCritico[]>`
    SELECT
      p."clave",
      p."estado",
      p."orden",
      p."lecturaInicial",
      p."lecturaFinal",
      COALESCE((p."datos"->>'pruebaProlongada')::boolean,false) AS "pruebaProlongada",
      (
        SELECT COUNT(*)::int
        FROM "GuiaInspeccionItem" g
        WHERE g."inspeccionId"=p."inspeccionId"
          AND g."area"=concat('__PUNTO_CRITICO__:',replace(p."clave",'PC_',''))
          AND g."estadoV3"='PENDIENTE'
          AND g."concepto" NOT ILIKE '%manómetro%'
          AND g."concepto" NOT ILIKE '%lectura final%'
      ) AS "pendientesNormales"
    FROM "ProtocoloInspeccionPaso" p
    WHERE p."inspeccionId"=${id}
      AND p."tipo"='PUNTO_CRITICO'
    ORDER BY p."orden"
  `;

  if (pasos.length === 0) {
    redirect(`/panel/inspecciones/${id}/puntos-criticos`);
  }

  // El orden del recorrido es sugerido. No se fuerza el primer punto pendiente:
  // el inspector puede abrir cualquier partida o área disponible.
  if (!control?.areasConfirmadas) {
    redirect(`/panel/inspecciones/${id}/areas`);
  }


  redirect(`/panel/inspecciones/${id}/campo-v1`);
}
