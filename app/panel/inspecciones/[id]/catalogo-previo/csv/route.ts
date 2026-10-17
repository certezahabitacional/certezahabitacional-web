import { NextResponse } from "next/server";
import { RolUsuario, EstadoInspeccion } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { vistaPreviaPartidasCotizadas } from "@/lib/vista-previa-partidas-cotizadas";

function csv(valor: string) { return '"' + valor.replaceAll('"', '""') + '"'; }

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("No autenticado", { status: 401 });
  const { id } = await params;
  const [usuario, inspeccion] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: session.user.id }, select: { id: true, activo: true, rol: true, inspector: { select: { id: true } } } }),
    prisma.inspeccion.findUnique({ where: { id }, select: { id: true, folio: true, estado: true, inspectorId: true, zonaId: true, cotizacion: { select: { versiones: { orderBy: { version: "desc" }, take: 1, select: { datos: true } } } } } }),
  ]);
  if (!usuario?.activo || !inspeccion) return new NextResponse("Sin acceso", { status: 403 });
  const permitido = usuario.rol === RolUsuario.DIRECTOR ||
    (usuario.rol === RolUsuario.ADMINISTRADOR && Boolean(inspeccion.zonaId) &&
      Boolean(await prisma.usuario.findFirst({ where: { id: usuario.id, zonaId: inspeccion.zonaId }, select: { id: true } }))) ||
    (usuario.rol === RolUsuario.INSPECTOR && usuario.inspector?.id === inspeccion.inspectorId);
  if (!permitido) return new NextResponse("Sin acceso", { status: 403 });
  if (inspeccion.estado !== EstadoInspeccion.PROGRAMADA) return new NextResponse("Disponible durante la preparación", { status: 409 });
  const raw = inspeccion.cotizacion?.versiones[0]?.datos;
  const datos = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const filas = [["Partida", "Área o subpartida", "Concepto", "Aplica", "Observaciones"]];
  for (const partida of vistaPreviaPartidasCotizadas(datos)) {
    for (const subpartida of partida.subpartidas) {
      for (const concepto of subpartida.conceptos) filas.push([partida.nombre, subpartida.nombre, concepto, "", ""]);
    }
  }
  const texto = "\uFEFF" + filas.map(f => f.map(csv).join(",")).join("\r\n");
  return new NextResponse(texto, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="catalogo-${inspeccion.folio.replace(/[^a-zA-Z0-9-]/g, "")}.csv"`, "Cache-Control": "no-store" } });
}
