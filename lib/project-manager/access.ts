import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const PM_INTERNAL_ROLES = ["DIRECTOR","ADMINISTRADOR","GERENTE","COORDINADOR","SUPERVISOR","RESIDENTE","CLIENTE"] as const;
export const PM_ADMIN_ROLES = ["DIRECTOR","ADMINISTRADOR"] as const;
export const PM_READ_ONLY_ROLES = ["CLIENTE"] as const;

export async function requireProjectManagerAccess() {
  const session = await auth();
  if (!session?.user) redirect("/project-manager/login");

  const userId = String((session.user as { id?: string }).id ?? "");
  const usuario = userId
    ? await prisma.usuario.findUnique({
        where: { id: userId },
        select: { rol: true, activo: true, projectManagerAutorizado: true },
      })
    : null;

  const role = String(usuario?.rol ?? "");
  const roleAllowed = PM_INTERNAL_ROLES.includes(role as (typeof PM_INTERNAL_ROLES)[number]);

  if (!usuario?.activo || !usuario.projectManagerAutorizado || !roleAllowed) {
    redirect("/project-manager/login?error=sin_acceso");
  }

  return {
    session,
    role,
    readOnly: PM_READ_ONLY_ROLES.includes(role as (typeof PM_READ_ONLY_ROLES)[number]),
  };
}

export async function requireProjectManagerWriteAccess() {
  const access = await requireProjectManagerAccess();
  if (access.readOnly) {
    redirect("/project-manager/panel?error=solo_lectura");
  }
  return access;
}

export async function requireProjectManagerAdmin() {
  const access = await requireProjectManagerWriteAccess();
  if (!PM_ADMIN_ROLES.includes(access.role as (typeof PM_ADMIN_ROLES)[number])) {
    redirect("/project-manager/panel?error=sin_permiso");
  }
  return access;
}

export async function requireProjectManagerDirector() {
  const access = await requireProjectManagerWriteAccess();
  if (access.role !== "DIRECTOR") {
    redirect("/project-manager/panel?error=sin_permiso");
  }
  return access;
}
