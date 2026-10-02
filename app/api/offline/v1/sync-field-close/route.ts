import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  operation?: string;
  payload?: { inspectionId?: string };
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sesión no disponible." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  if (body.operation !== "FIELD_CLOSE_REQUEST_V1") {
    return NextResponse.json({ error: "Operación offline no soportada." }, { status: 400 });
  }

  const inspectionId = String(body.payload?.inspectionId ?? "").trim();
  if (!inspectionId) return NextResponse.json({ error: "Inspección inválida." }, { status: 400 });

  const [usuario, inspeccion] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { id: true, activo: true, rol: true, inspector: { select: { id: true, activo: true } } },
    }),
    prisma.inspeccion.findUnique({
      where: { id: inspectionId },
      select: {
        id: true,
        folio: true,
        estado: true,
        numeroInspeccion: true,
        inspectorId: true,
        firmas: { select: { tipo: true, firmadaEn: true } },
      },
    }),
  ]);

  const permitido =
    usuario?.activo &&
    inspeccion?.numeroInspeccion === 1 &&
    inspeccion.estado === EstadoInspeccion.EN_PROCESO &&
    (
      usuario.rol === RolUsuario.DIRECTOR ||
      (usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.activo && usuario.inspector.id === inspeccion.inspectorId)
    );
  if (!permitido || !usuario || !inspeccion) {
    return NextResponse.json({ error: "No tienes acceso para cerrar esta inspección." }, { status: 403 });
  }

  const [control] = await prisma.$queryRaw<Array<{
    inspeccionTecnicaConcluidaEn: Date | null;
    campoFinalizadoEn: Date | null;
    preReporteGeneradoEn: Date | null;
    reabiertaEn: Date | null;
  }>>`
    SELECT "inspeccionTecnicaConcluidaEn","campoFinalizadoEn","preReporteGeneradoEn","reabiertaEn"
    FROM "InspeccionControlV2"
    WHERE "inspeccionId"=${inspectionId}
    LIMIT 1
  `;

  if (control?.campoFinalizadoEn) return NextResponse.json({ ok: true, duplicate: true });
  if (!control?.inspeccionTecnicaConcluidaEn || !control.preReporteGeneradoEn) {
    return NextResponse.json({ error: "Primero concluye la inspección técnica y genera el reporte para revisión." }, { status: 409 });
  }

  const desde = control.reabiertaEn ? new Date(control.reabiertaEn) : null;
  const firmasVigentes = inspeccion.firmas.filter((firma) => !desde || new Date(firma.firmadaEn) >= desde);
  const firmaInspector = firmasVigentes.some((firma) => firma.tipo.toLowerCase().includes("inspector"));
  const firmaCliente = firmasVigentes.some((firma) => firma.tipo.toLowerCase().includes("cliente"));
  if (!firmaInspector || !firmaCliente) {
    return NextResponse.json({ error: "Faltan firmas vigentes del Inspector y Cliente." }, { status: 409 });
  }

  const [r] = await prisma.$queryRaw<Array<{
    areasTotal: number;
    areasCompletas: number;
    protocoloTotal: number;
    protocoloCompleto: number;
    hallazgosIncompletos: number;
    fachadaPortadas: number;
    fachadaNoAplica: number;
    syncPendientes: number;
  }>>`
    SELECT
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a WHERE a."inspeccionId"=${inspectionId} AND a."obligatoria"=true) AS "areasTotal",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a WHERE a."inspeccionId"=${inspectionId} AND a."obligatoria"=true AND a."estado"='REVISADA' AND a."resultado" IN ('SIN_HALLAZGOS','CON_HALLAZGOS','NO_APLICA')) AS "areasCompletas",
      (SELECT COUNT(*)::int FROM "ProtocoloInspeccionPaso" p WHERE p."inspeccionId"=${inspectionId} AND p."obligatorio"=true) AS "protocoloTotal",
      (SELECT COUNT(*)::int FROM "ProtocoloInspeccionPaso" p WHERE p."inspeccionId"=${inspectionId} AND p."obligatorio"=true AND p."estado" IN ('COMPLETADO','NO_APLICA')) AS "protocoloCompleto",
      (SELECT COUNT(*)::int FROM "Hallazgo" h WHERE h."inspeccionId"=${inspectionId} AND (((SELECT COUNT(*) FROM "Fotografia" f WHERE f."hallazgoId"=h."id") NOT BETWEEN 1 AND 4) OR nullif(btrim(coalesce(h."descripcion",'')),'') IS NULL)) AS "hallazgosIncompletos",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a JOIN "FotografiaArea" fa ON fa."areaId"=a."id" WHERE a."inspeccionId"=${inspectionId} AND a."codigo" IN ('FACHADA_FRONTAL','FACHADA_PRINCIPAL') AND fa."candidataPortada"=true) AS "fachadaPortadas",
      (SELECT COUNT(*)::int FROM "AreaInspeccion" a WHERE a."inspeccionId"=${inspectionId} AND a."codigo" IN ('FACHADA_FRONTAL','FACHADA_PRINCIPAL') AND a."resultado"='NO_APLICA') AS "fachadaNoAplica",
      (SELECT COUNT(*)::int FROM "OperacionCampoSync" s WHERE s."inspeccionId"=${inspectionId} AND s."estado" <> 'PROCESADA') AS "syncPendientes"
  `;

  if (!r || r.areasTotal === 0 || r.areasCompletas !== r.areasTotal) {
    return NextResponse.json({ error: "Aún existen áreas pendientes por cerrar." }, { status: 409 });
  }
  if (r.protocoloTotal === 0 || r.protocoloCompleto !== r.protocoloTotal) {
    return NextResponse.json({ error: "Aún existen procesos técnicos pendientes, incluida hermeticidad." }, { status: 409 });
  }
  if (r.hallazgosIncompletos > 0) {
    return NextResponse.json({ error: "Existen hallazgos incompletos." }, { status: 409 });
  }
  if (r.fachadaNoAplica === 0 && r.fachadaPortadas !== 1) {
    return NextResponse.json({ error: "Falta seleccionar la fotografía de portada." }, { status: 409 });
  }
  if (r.syncPendientes > 0) {
    return NextResponse.json({ error: "Existen operaciones del servidor pendientes de sincronización." }, { status: 409 });
  }

  await prisma.$executeRaw`
    UPDATE "InspeccionControlV2"
    SET "campoFinalizadoEn"=NOW(),
        "reporteLimiteEn"=NOW() + interval '12 hours',
        "revisionInspectorFinalEn"=NULL,
        "revisionInspectorFinalPorId"=NULL,
        "actualizadoEn"=NOW()
    WHERE "inspeccionId"=${inspectionId}
      AND "campoFinalizadoEn" IS NULL
  `;

  await registrarAuditoria({
    tipo: TipoEvento.FINALIZAR_CAPTURA,
    entidad: "InspeccionControlV2",
    inspeccionId: inspectionId,
    usuarioId: usuario.id,
    descripcion: `Solicitud de cierre de campo capturada sin conexión y aplicada al sincronizar ${inspeccion.folio}.`,
  });

  return NextResponse.json({ ok: true });
}
