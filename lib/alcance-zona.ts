import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type UsuarioConAlcanceZona = {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  zonaId: string | null;
  zona: {
    id: string;
    nombre: string;
    codigo: string;
    zonaHoraria: string;
  } | null;
  inspector: { id: string } | null;
};

export async function obtenerUsuarioConAlcanceZona(
  callbackUrl = "/panel",
): Promise<UsuarioConAlcanceZona> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      zonaId: true,
      zona: {
        select: {
          id: true,
          nombre: true,
          codigo: true,
          zonaHoraria: true,
        },
      },
      inspector: { select: { id: true } },
    },
  });

  if (!usuario?.activo) redirect("/acceso");

  if (usuario.rol !== RolUsuario.DIRECTOR && !usuario.zonaId) {
    redirect(
      `/acceso?error=${encodeURIComponent(
        "Tu usuario no tiene una zona asignada. Solicita a Dirección que complete tu configuración.",
      )}`,
    );
  }

  return usuario;
}

export function esDirectorGlobal(usuario: Pick<UsuarioConAlcanceZona, "rol">) {
  return usuario.rol === RolUsuario.DIRECTOR;
}

export function zonaEfectivaId(
  usuario: Pick<UsuarioConAlcanceZona, "rol" | "zonaId">,
  zonaSolicitadaId?: string | null,
): string | null {
  if (usuario.rol === RolUsuario.DIRECTOR) {
    return zonaSolicitadaId?.trim() || null;
  }

  return usuario.zonaId;
}

export function puedeAccederZona(
  usuario: Pick<UsuarioConAlcanceZona, "rol" | "zonaId">,
  zonaRegistroId: string | null | undefined,
): boolean {
  if (usuario.rol === RolUsuario.DIRECTOR) return true;
  return Boolean(usuario.zonaId && zonaRegistroId && usuario.zonaId === zonaRegistroId);
}

export function exigirAccesoZona(
  usuario: Pick<UsuarioConAlcanceZona, "rol" | "zonaId">,
  zonaRegistroId: string | null | undefined,
  mensaje = "No tienes acceso a información de otra zona.",
): void {
  if (!puedeAccederZona(usuario, zonaRegistroId)) {
    throw new Error(mensaje);
  }
}

export function descripcionAlcanceZona(
  usuario: Pick<UsuarioConAlcanceZona, "rol" | "zona">,
) {
  if (usuario.rol === RolUsuario.DIRECTOR) return "Todas las zonas";
  return usuario.zona ? `${usuario.zona.nombre} · ${usuario.zona.codigo}` : "Zona no asignada";
}
