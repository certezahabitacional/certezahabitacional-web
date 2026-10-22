import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const PM_INTERNAL_ROLES = ["DIRECTOR","ADMINISTRADOR","GERENTE","COORDINADOR","INSPECTOR"] as const;
export const PM_ADMIN_ROLES = ["DIRECTOR","ADMINISTRADOR"] as const;

function getRole(session: Awaited<ReturnType<typeof auth>>) {
  return String((session?.user as { role?: string } | undefined)?.role ?? "");
}

export async function requireProjectManagerAccess() {
  const session = await auth();
  if (!session?.user) redirect("/project-manager/login");
  const role = getRole(session);
  if (!PM_INTERNAL_ROLES.includes(role as (typeof PM_INTERNAL_ROLES)[number])) {
    redirect("/project-manager/login?error=sin_acceso");
  }
  return { session, role };
}

export async function requireProjectManagerAdmin() {
  const access = await requireProjectManagerAccess();
  if (!PM_ADMIN_ROLES.includes(access.role as (typeof PM_ADMIN_ROLES)[number])) {
    redirect("/project-manager/panel?error=sin_permiso");
  }
  return access;
}
