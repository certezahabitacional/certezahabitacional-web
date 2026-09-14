import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  obtenerUsuarioConAlcanceZona,
  puedeAccederZona,
} from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";

export async function exigirZonaInspeccionPorId(
  inspeccionId: string,
  callbackUrl = "/panel/inspecciones",
) {
  if (!inspeccionId) redirect("/acceso");

  const usuario = await obtenerUsuarioConAlcanceZona(callbackUrl);
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { id: true, zonaId: true },
  });

  if (!inspeccion || !puedeAccederZona(usuario, inspeccion.zonaId)) {
    redirect("/acceso");
  }

  return { usuario, inspeccion };
}

export async function exigirZonaInspeccionForm(formData: FormData) {
  let inspeccionId = String(
    formData.get("inspeccionId") ?? formData.get("id") ?? "",
  ).trim();

  if (!inspeccionId) {
    const hallazgoId = String(formData.get("hallazgoId") ?? "").trim();
    if (hallazgoId) {
      const hallazgo = await prisma.hallazgo.findUnique({
        where: { id: hallazgoId },
        select: { inspeccionId: true },
      });
      inspeccionId = hallazgo?.inspeccionId ?? "";
    }
  }

  if (!inspeccionId) {
    const reasignacionId = String(formData.get("reasignacionId") ?? "").trim();
    if (reasignacionId) {
      const reasignacion = await prisma.reasignacionInspector.findUnique({
        where: { id: reasignacionId },
        select: { inspeccionId: true },
      });
      inspeccionId = reasignacion?.inspeccionId ?? "";
    }
  }

  if (!inspeccionId) {
    const fotografiaId = String(formData.get("fotografiaId") ?? "").trim();
    if (fotografiaId) {
      const fotografia = await prisma.fotografia.findUnique({
        where: { id: fotografiaId },
        select: { inspeccionId: true },
      });
      inspeccionId = fotografia?.inspeccionId ?? "";
    }
  }

  return exigirZonaInspeccionPorId(inspeccionId);
}

type ResultadoZonaApi =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function validarZonaInspeccionApi(
  inspeccionId: string,
): Promise<ResultadoZonaApi> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "No autorizado" };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true, zonaId: true },
  });

  if (!usuario?.activo) {
    return {
      ok: false,
      status: 403,
      error: "Usuario inactivo o no autorizado.",
    };
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id: inspeccionId },
    select: { zonaId: true },
  });

  if (!inspeccion) {
    return { ok: false, status: 404, error: "Expediente no encontrado" };
  }

  if (!puedeAccederZona(usuario, inspeccion.zonaId)) {
    return {
      ok: false,
      status: 403,
      error: "No tienes acceso a información de otra zona.",
    };
  }

  return { ok: true };
}
