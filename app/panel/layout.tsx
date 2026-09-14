import type { ReactNode } from "react";

import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import PlatformHeader from "@/components/branding/PlatformHeader";
import PanelMenu from "@/components/panel/PanelMenu";
import { opcionesPanelPorRol } from "@/lib/panel-navegacion";
import { prisma } from "@/lib/prisma";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuarioActual = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { nombre: true, email: true, rol: true, activo: true, zonaId: true, zona: { select: { nombre: true, codigo: true } } },
  });
  if (!usuarioActual || !usuarioActual.activo) redirect("/acceso");
  if (usuarioActual.rol === RolUsuario.CLIENTE) redirect("/portal");
  if (usuarioActual.rol !== RolUsuario.DIRECTOR && !usuarioActual.zonaId) redirect(`/acceso?error=${encodeURIComponent("Tu usuario no tiene una zona asignada.")}`);

  const opciones = opcionesPanelPorRol(usuarioActual.rol);
  if (opciones.length === 0) redirect("/acceso");
  const nombreUsuario = usuarioActual.nombre?.trim() || usuarioActual.email || "Usuario";
  const areaPorRol: Partial<Record<RolUsuario,string>> = { [RolUsuario.DIRECTOR]:"Dirección",[RolUsuario.ADMINISTRADOR]:"Administración",[RolUsuario.GERENTE]:"Gerencia",[RolUsuario.COORDINADOR]:"Coordinación",[RolUsuario.VENDEDOR]:"Ventas",[RolUsuario.INSPECTOR]:"Portal del Inspector" };
  const descripcionPorRol: Partial<Record<RolUsuario,string>> = { [RolUsuario.DIRECTOR]:"Control ejecutivo y acceso a todas las zonas",[RolUsuario.ADMINISTRADOR]:"Operación administrativa y comercial",[RolUsuario.GERENTE]:"Control operativo y seguimiento",[RolUsuario.COORDINADOR]:"Revisión técnica y seguimiento de Inspectores",[RolUsuario.VENDEDOR]:"Consulta comercial y seguimiento de expedientes",[RolUsuario.INSPECTOR]:"Captura y seguimiento de tus inspecciones asignadas" };
  const alcance = usuarioActual.rol===RolUsuario.DIRECTOR ? "Todas las zonas" : usuarioActual.zona ? `${usuarioActual.zona.nombre} · ${usuarioActual.zona.codigo}` : "Zona no asignada";
  const logout=<form action={async()=>{"use server";await signOut({redirectTo:"/login"});}}><button type="submit" className="rounded-full border border-amber-300/40 px-5 py-3 font-black text-amber-200 transition hover:bg-amber-300/10">Cerrar sesión</button></form>;

  return <div className="min-h-screen bg-slate-950 text-white"><PlatformHeader area={areaPorRol[usuarioActual.rol]??"Panel"} subtitle={`Sesión iniciada como ${nombreUsuario} · ${alcance} · ${descripcionPorRol[usuarioActual.rol]??"Operación del sistema"}`} actions={logout}/><PanelMenu opciones={opciones}/>{children}</div>;
}
