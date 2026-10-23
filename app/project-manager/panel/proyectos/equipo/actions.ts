"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManagerDirector } from "@/lib/project-manager/access";

const ASSIGNABLE_ROLES = ["GERENTE","COORDINADOR","SUPERVISOR","RESIDENTE","CLIENTE"] as const;

export async function asignarParticipantePM(formData: FormData) {
  await requireProjectManagerDirector();

  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const usuarioId = String(formData.get("usuarioId") ?? "").trim();
  if (!codigo || !usuarioId) return;

  const [proyecto, usuario] = await Promise.all([
    prisma.proyectoPM.findUnique({ where: { codigo }, select: { id: true, codigo: true } }),
    prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, rol: true, activo: true, projectManagerAutorizado: true },
    }),
  ]);

  if (!proyecto || !usuario || !usuario.activo || !usuario.projectManagerAutorizado) return;
  if (!ASSIGNABLE_ROLES.includes(usuario.rol as (typeof ASSIGNABLE_ROLES)[number])) return;

  await prisma.proyectoPMUsuario.upsert({
    where: { proyectoId_usuarioId: { proyectoId: proyecto.id, usuarioId: usuario.id } },
    create: {
      proyectoId: proyecto.id,
      usuarioId: usuario.id,
      rolEnProyecto: usuario.rol,
      soloLectura: usuario.rol === "CLIENTE",
    },
    update: {
      rolEnProyecto: usuario.rol,
      soloLectura: usuario.rol === "CLIENTE",
    },
  });

  revalidatePath("/project-manager/panel/proyectos");
  revalidatePath("/project-manager/panel/proyectos/equipo");
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}`);
}

export async function retirarParticipantePM(formData: FormData) {
  const { session } = await requireProjectManagerDirector();

  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const participanteId = String(formData.get("participanteId") ?? "").trim();
  const currentId = String((session.user as { id?: string }).id ?? "");
  if (!codigo || !participanteId) return;

  const participante = await prisma.proyectoPMUsuario.findUnique({
    where: { id: participanteId },
    include: {
      proyecto: { select: { codigo: true } },
      usuario: { select: { id: true, rol: true } },
    },
  });

  if (!participante || participante.proyecto.codigo !== codigo) return;
  if (participante.usuario.id === currentId || participante.usuario.rol === "DIRECTOR") return;

  await prisma.proyectoPMUsuario.delete({ where: { id: participante.id } });

  revalidatePath("/project-manager/panel/proyectos");
  revalidatePath("/project-manager/panel/proyectos/equipo");
  revalidatePath(`/project-manager/panel/proyectos/${codigo.toLowerCase()}`);
}

export async function volverAlProyecto(formData: FormData) {
  const codigo = String(formData.get("codigo") ?? "").trim().toLowerCase();
  if (!codigo) redirect("/project-manager/panel/proyectos");
  redirect(`/project-manager/panel/proyectos/${codigo}`);
}
