"use server";

import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(fd: FormData, campo: string) {
  return String(fd.get(campo) ?? "").trim();
}

function volver(id: string, perfil: string, tipo: "ok" | "error", mensaje: string): never {
  redirect("/panel/inspecciones/" + id + "/plan-inspeccion?perfil=" + encodeURIComponent(perfil) + "&" + tipo + "=" + encodeURIComponent(mensaje));
}

async function contexto(inspeccionId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [usuario, inspeccion] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { id: true, rol: true, activo: true, inspector: { select: { id: true, activo: true } } },
    }),
    prisma.inspeccion.findUnique({
      where: { id: inspeccionId },
      select: { id: true, folio: true, estado: true, numeroInspeccion: true, inspectorId: true },
    }),
  ]);

  if (!usuario?.activo || !inspeccion) redirect("/acceso");
  if (inspeccion.numeroInspeccion !== 1) redirect("/panel/inspecciones/" + inspeccionId);

  const inspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    usuario.inspector?.id === inspeccion.inspectorId;
  const director = usuario.rol === RolUsuario.DIRECTOR;
  if (!inspectorAsignado && !director) redirect("/acceso");

  if (inspeccion.estado !== EstadoInspeccion.PROGRAMADA) {
    volver(inspeccionId, "NUEVA", "error", "La planeación oficial solo puede modificarse antes de iniciar la inspección.");
  }

  return { usuario, inspeccion };
}

type PartidaSeleccion = {
  clave: string;
  codigo: string;
  nombre: string;
  activa: boolean;
  puntos: string[];
};

function parsearSeleccion(fd: FormData): PartidaSeleccion[] {
  const metaRaw = texto(fd, "partidasMeta");
  let meta: Array<{ clave: string; codigo: string; nombre: string }> = [];
  try {
    const parsed = JSON.parse(metaRaw);
    if (Array.isArray(parsed)) meta = parsed;
  } catch {
    meta = [];
  }

  const activas = new Set(
    [...fd.keys()]
      .filter((k) => k.startsWith("partida::"))
      .map((k) => k.slice("partida::".length)),
  );

  const puntos = new Map<string, string[]>();
  for (const key of fd.keys()) {
    if (!key.startsWith("punto::")) continue;
    const resto = key.slice("punto::".length);
    const separador = resto.lastIndexOf("::");
    if (separador < 1) continue;
    const clave = resto.slice(0, separador);
    const codigo = resto.slice(separador + 2);
    puntos.set(clave, [...(puntos.get(clave) ?? []), codigo]);
  }

  return meta.map((partida) => ({
    ...partida,
    activa: activas.has(partida.clave),
    puntos: Array.from(new Set(puntos.get(partida.clave) ?? [])),
  }));
}

export async function guardarPlanInspeccionV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const perfil = texto(formData, "perfil") === "USADA" ? "USADA" : "NUEVA";
  const intencion = texto(formData, "intencion") === "CONFIRMAR" ? "CONFIRMAR" : "GUARDAR";
  const estimadoMinutos = Math.max(0, Number(texto(formData, "estimadoMinutos")) || 0);
  if (!inspeccionId) redirect("/panel/inspecciones");

  const { usuario, inspeccion } = await contexto(inspeccionId);
  const partidas = parsearSeleccion(formData);
  const activas = partidas.filter((p) => p.activa);
  const totalPuntos = activas.reduce((s, p) => s + p.puntos.length, 0);

  if (!partidas.length) volver(inspeccionId, perfil, "error", "No fue posible leer las partidas propuestas.");
  if (!activas.length) volver(inspeccionId, perfil, "error", "Selecciona al menos una partida para la inspección.");
  if (totalPuntos < 1) volver(inspeccionId, perfil, "error", "Selecciona al menos un punto de inspección.");

  const estado = intencion === "CONFIRMAR" ? "CONFIRMADO" : "BORRADOR";
  const seleccion = {
    version: 1,
    perfil,
    partidas,
    totalPartidas: activas.length,
    totalPuntos,
  };

  await prisma.$executeRawUnsafe(
    'INSERT INTO "PlanInspeccionV1" ("inspeccionId","perfil","estado","seleccion","estimadoMinutos","confirmadoPorId","confirmadoEn","actualizadoEn") VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,NOW()) ON CONFLICT ("inspeccionId") DO UPDATE SET "perfil"=EXCLUDED."perfil","estado"=EXCLUDED."estado","seleccion"=EXCLUDED."seleccion","estimadoMinutos"=EXCLUDED."estimadoMinutos","confirmadoPorId"=EXCLUDED."confirmadoPorId","confirmadoEn"=EXCLUDED."confirmadoEn","actualizadoEn"=NOW()',
    inspeccionId,
    perfil,
    estado,
    JSON.stringify(seleccion),
    estimadoMinutos,
    estado === "CONFIRMADO" ? usuario.id : null,
    estado === "CONFIRMADO" ? new Date() : null,
  );

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "PlanInspeccionV1",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: intencion === "CONFIRMAR"
      ? usuario.rol + " confirmó el plan previo de " + inspeccion.folio + ": " + activas.length + " partida(s), " + totalPuntos + " punto(s) maestro(s), perfil " + perfil + "."
      : usuario.rol + " guardó borrador del plan previo de " + inspeccion.folio + ": " + activas.length + " partida(s), " + totalPuntos + " punto(s) maestro(s), perfil " + perfil + ".",
  });

  revalidatePath("/panel/inspecciones/" + inspeccionId + "/plan-inspeccion");
  revalidatePath("/panel/inspecciones/" + inspeccionId + "/revision-inicial");
  revalidatePath("/panel/inspecciones");

  volver(
    inspeccionId,
    perfil,
    "ok",
    intencion === "CONFIRMAR"
      ? "Plan de inspección confirmado. Este será el alcance oficial para iniciar la V1."
      : "Borrador del plan guardado.",
  );
}

export async function reabrirPlanInspeccionV1(formData: FormData) {
  const inspeccionId = texto(formData, "inspeccionId");
  const perfil = texto(formData, "perfil") === "USADA" ? "USADA" : "NUEVA";
  if (!inspeccionId) redirect("/panel/inspecciones");
  const { usuario, inspeccion } = await contexto(inspeccionId);

  await prisma.$executeRawUnsafe(
    'UPDATE "PlanInspeccionV1" SET "estado"=\'BORRADOR\',"confirmadoPorId"=NULL,"confirmadoEn"=NULL,"actualizadoEn"=NOW() WHERE "inspeccionId"=$1',
    inspeccionId,
  );

  await registrarAuditoria({
    tipo: TipoEvento.EDITAR,
    entidad: "PlanInspeccionV1",
    inspeccionId,
    usuarioId: usuario.id,
    descripcion: usuario.rol + " reabrió el plan previo de " + inspeccion.folio + " para ajustarlo antes de iniciar.",
  });

  revalidatePath("/panel/inspecciones/" + inspeccionId + "/plan-inspeccion");
  volver(inspeccionId, perfil, "ok", "Plan reabierto. Puedes ajustar partidas y puntos antes de volver a confirmarlo.");
}
