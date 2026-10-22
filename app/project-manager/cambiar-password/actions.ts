"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function cambiarMiPasswordProjectManager(formData: FormData) {
  const session = await auth();
  const userId = String((session?.user as { id?: string } | undefined)?.id ?? "");
  if (!userId) redirect("/project-manager/login");

  const actual = String(formData.get("actual") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");
  if (nueva.length < 8 || nueva !== confirmar) redirect("/project-manager/cambiar-password?error=datos");

  const usuario = await prisma.usuario.findUnique({ where:{id:userId}, select:{passwordHash:true} });
  if (!usuario || !(await bcrypt.compare(actual,usuario.passwordHash))) redirect("/project-manager/cambiar-password?error=actual");

  const passwordHash=await bcrypt.hash(nueva,12);
  await prisma.usuario.update({
    where:{id:userId},
    data:{passwordHash,requiereCambioPassword:false,intentosFallidos:0,bloqueadoHasta:null,ultimoFalloLogin:null},
  });
  redirect("/project-manager/cambiar-password?ok=1");
}
