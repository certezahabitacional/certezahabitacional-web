import { randomUUID } from "node:crypto";
import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  obtenerHerramientasCotizadasDesdeCotizacion,
  type CodigoHerramienta,
} from "@/lib/herramientas-inspeccion";
import {
  PUNTOS_CRITICOS_V1,
  plantillaAplicablePuntoCritico,
  proyectoDisponibleParaPuntoCritico,
  tienePruebaProlongadaCotizada,
} from "@/lib/puntos-criticos-v1";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DatosPasoCritico = {
  configurado: boolean;
  aplica: boolean;
  fuente: "PROYECTO" | "PLANTILLA";
  proyectoDisponible: boolean;
  pruebaProlongada: boolean;
  herramientas: CodigoHerramienta[];
  preparadoOffline?: boolean;
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });
  }

  const [usuario, inspeccion, control] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        activo: true,
        rol: true,
        inspector: { select: { id: true, activo: true } },
      },
    }),
    prisma.inspeccion.findUnique({
      where: { id },
      select: {
        id: true,
        folio: true,
        estado: true,
        numeroInspeccion: true,
        inspectorId: true,
        cotizacion: { select: { observacionesInternas: true } },
      },
    }),
    prisma.$queryRaw<Array<{ proyectoConfirmado: boolean; areasConfirmadas: boolean }>>`
      SELECT "proyectoConfirmado","areasConfirmadas"
      FROM "InspeccionControlV2"
      WHERE "inspeccionId"=${id}
      LIMIT 1
    `.then((rows) => rows[0] ?? null),
  ]);

  const permitido =
    usuario?.activo &&
    inspeccion?.numeroInspeccion === 1 &&
    inspeccion.estado === EstadoInspeccion.EN_PROCESO &&
    (
      usuario.rol === RolUsuario.DIRECTOR ||
      (
        usuario.rol === RolUsuario.INSPECTOR &&
        usuario.inspector?.activo &&
        usuario.inspector.id === inspeccion.inspectorId
      )
    );

  if (!permitido || !usuario || !inspeccion) {
    return NextResponse.json({ error: "No tienes acceso para preparar esta inspección." }, { status: 403 });
  }

  if (!control?.proyectoConfirmado) {
    return NextResponse.json({ error: "Primero confirma Proyecto/Plantilla." }, { status: 409 });
  }
  if (!control.areasConfirmadas) {
    return NextResponse.json({ error: "Primero confirma las áreas del inmueble." }, { status: 409 });
  }

  const herramientas = obtenerHerramientasCotizadasDesdeCotizacion(
    inspeccion.cotizacion?.observacionesInternas,
  );

  const documentos = await prisma.$queryRaw<Array<{ tipo: string; datosExtraidos: unknown }>>`
    SELECT "tipo","datosExtraidos"
    FROM "DocumentoProyectoInspeccion"
    WHERE "inspeccionId"=${id}
      AND "estadoAnalisis"='COMPLETADO'
  `;

  let preparados = 0;

  for (let indice = 0; indice < PUNTOS_CRITICOS_V1.length; indice += 1) {
    const punto = PUNTOS_CRITICOS_V1[indice];
    const proyectoDisponible = proyectoDisponibleParaPuntoCritico(punto, documentos);
    const fuente: "PROYECTO" | "PLANTILLA" = proyectoDisponible ? "PROYECTO" : "PLANTILLA";
    const pruebaProlongada = tienePruebaProlongadaCotizada(punto, herramientas);
    const herramientasEfectivas = [...herramientas];

    if (pruebaProlongada && punto.codigo === "HIDRAULICA") {
      if (!herramientasEfectivas.includes("HERMETICIDAD_HIDRAULICA")) {
        herramientasEfectivas.push("HERMETICIDAD_HIDRAULICA");
      }
      if (!herramientasEfectivas.includes("MANOMETRO_AGUA")) {
        herramientasEfectivas.push("MANOMETRO_AGUA");
      }
    }
    if (pruebaProlongada && punto.codigo === "GAS") {
      if (!herramientasEfectivas.includes("HERMETICIDAD_GAS")) {
        herramientasEfectivas.push("HERMETICIDAD_GAS");
      }
    }

    const datos: DatosPasoCritico = {
      configurado: true,
      aplica: true,
      fuente,
      proyectoDisponible,
      pruebaProlongada,
      herramientas: herramientasEfectivas,
      preparadoOffline: true,
    };

    const plantilla = plantillaAplicablePuntoCritico(punto, herramientasEfectivas);
    const areaCodigo = `PC_${punto.codigo}`;
    const areaMarcador = `__PUNTO_CRITICO__:${punto.codigo}`;

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "ProtocoloInspeccionPaso"
          ("inspeccionId","clave","nombre","tipo","orden","obligatorio","estado","datos","actualizadoEn")
        VALUES
          (${id},${areaCodigo},${punto.etiqueta},'PUNTO_CRITICO',${100 + indice * 10},true,'EN_PROCESO',${JSON.stringify(datos)}::jsonb,NOW())
        ON CONFLICT ("inspeccionId","clave") DO UPDATE
        SET "datos"=CASE
              WHEN COALESCE(("ProtocoloInspeccionPaso"."datos"->>'configurado')::boolean,false)=true
                THEN "ProtocoloInspeccionPaso"."datos"
              ELSE EXCLUDED."datos"
            END,
            "estado"=CASE
              WHEN "ProtocoloInspeccionPaso"."estado" IN ('COMPLETADO','NO_APLICA')
                THEN "ProtocoloInspeccionPaso"."estado"
              ELSE 'EN_PROCESO'
            END,
            "iniciadoEn"=COALESCE("ProtocoloInspeccionPaso"."iniciadoEn",NOW()),
            "actualizadoEn"=NOW()
      `;

      await tx.$executeRaw`
        INSERT INTO "AreaInspeccion"
          ("inspeccionId","codigo","nombre","tipo","orden","origen","obligatoria","estado")
        VALUES
          (${id},${areaCodigo},${punto.etiqueta},'PUNTO_CRITICO',
           ${900 + indice * 10},${fuente},false,'PENDIENTE')
        ON CONFLICT ("inspeccionId","codigo") DO UPDATE
        SET "origen"=EXCLUDED."origen","actualizadoEn"=NOW()
      `;

      const [area] = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"::text
        FROM "AreaInspeccion"
        WHERE "inspeccionId"=${id}
          AND "codigo"=${areaCodigo}
        LIMIT 1
      `;
      if (!area) throw new Error(`No fue posible preparar ${punto.etiqueta}.`);

      let orden = 10;
      for (const item of plantilla) {
        await tx.$executeRaw`
          INSERT INTO "GuiaInspeccionItem"
            ("id","inspeccionId","origen","tipoProyecto","area","concepto","especificacion",
             "orden","obligatorio","completado","creadoPorId","areaId","estadoV3","origenV3",
             "requiereMedicion","requiereComparacionProyecto","herramientaSugerida","creadoEn","actualizadoEn")
          SELECT
            ${randomUUID()},${id},'PUNTO_CRITICO',${punto.codigo},${areaMarcador},
            ${item.nombre},${item.descripcion},${orden},true,false,${usuario.id},
            ${area.id}::uuid,'PENDIENTE',${fuente},${item.requiereMedicion},
            ${item.requiereComparacionProyecto},${item.herramientaSugerida},NOW(),NOW()
          WHERE NOT EXISTS (
            SELECT 1
            FROM "GuiaInspeccionItem"
            WHERE "inspeccionId"=${id}
              AND "area"=${areaMarcador}
              AND "concepto"=${item.nombre}
          )
        `;
        orden += 10;
      }
    });

    preparados += 1;
  }

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "ProtocoloInspeccionPaso",
    inspeccionId: id,
    usuarioId: usuario.id,
    descripcion: `Se prepararon automáticamente ${preparados} puntos críticos y sus plantillas para trabajo sin conexión en ${inspeccion.folio}.`,
  });

  return NextResponse.json({ ok: true, preparados });
}
