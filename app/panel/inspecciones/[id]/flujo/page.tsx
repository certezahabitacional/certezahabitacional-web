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

  const [control] = await prisma.$queryRaw<Array<{ proyectoConfirmado: boolean; areasConfirmadas: boolean }>>`
    SELECT "proyectoConfirmado","areasConfirmadas"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${id}
    LIMIT 1
  `;

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

  const pendiente = pasos.find((paso) => {
    if (paso.estado === "COMPLETADO" || paso.estado === "NO_APLICA") return false;

    const esHermeticidadAbierta =
      ["PC_HIDRAULICA", "PC_GAS"].includes(paso.clave) &&
      paso.pruebaProlongada &&
      Boolean(paso.lecturaInicial) &&
      !paso.lecturaFinal &&
      Number(paso.pendientesNormales) === 0;

    // Una prueba de hermeticidad abierta NO bloquea el paso a las áreas.
    // Su lectura final se toma después de concluir todas las áreas.
    return !esHermeticidadAbierta;
  });

  if (pendiente) {
    const codigo = pendiente.clave.replace(/^PC_/, "");
    redirect(
      `/panel/inspecciones/${id}/puntos-criticos?punto=${encodeURIComponent(codigo)}`,
    );
  }

  if (control?.areasConfirmadas) {
    const [areaActiva] = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"::text
      FROM "AreaInspeccion"
      WHERE "inspeccionId"=${id}
        AND "tipo" <> 'PUNTO_CRITICO'
        AND "estado" <> 'REVISADA'
      ORDER BY "orden","nombre"
      LIMIT 1
    `;
    if (areaActiva?.id) {
      redirect(`/panel/inspecciones/${id}/campo-v1?area=${areaActiva.id}`);
    }
  }

  redirect(`/panel/inspecciones/${id}/areas`);
}
