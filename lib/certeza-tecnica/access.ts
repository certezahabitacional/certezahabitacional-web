import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAuthorizedProjectCodes } from "@/lib/project-manager/access";

const COST_ROLES=["DIRECTOR","ADMINISTRADOR"] as const;

export async function requireCertezaCostAccess(callbackUrl:string){
  const session=await auth();
  if(!session?.user?.id){
    redirect(`/certeza-tecnica/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const usuario=await prisma.usuario.findUnique({
    where:{id:String(session.user.id)},
    select:{id:true,nombre:true,email:true,rol:true,activo:true},
  });

  if(!usuario?.activo){
    redirect(`/certeza-tecnica/login?callbackUrl=${encodeURIComponent(callbackUrl)}&error=sin_acceso`);
  }

  const role=String(usuario.rol);
  if(!COST_ROLES.includes(role as (typeof COST_ROLES)[number])){
    redirect(`/certeza-tecnica/login?callbackUrl=${encodeURIComponent(callbackUrl)}&error=sin_permiso_costos`);
  }

  return usuario;
}


export async function getAuthorizedCostProjectCodes(callbackUrl: string) {
  const usuario = await requireCertezaCostAccess(callbackUrl);
  return {
    usuario,
    codigos: await getAuthorizedProjectCodes(usuario.id),
  };
}

export async function requireCertezaCostProjectAccess(projectCostId: string, callbackUrl: string) {
  const usuario = await requireCertezaCostAccess(callbackUrl);
  const proyectoCost = await prisma.proyectoGeneradores.findUnique({
    where: { id: projectCostId },
    select: { id: true, codigo: true },
  });

  if (!proyectoCost) notFound();

  const autorizado = await prisma.proyectoPM.findFirst({
    where: {
      codigo: proyectoCost.codigo,
      activo: true,
      OR: [
        { participantes: { some: { usuarioId: usuario.id } } },
        { creadoPorId: usuario.id },
      ],
    },
    select: { id: true },
  });

  if (!autorizado) notFound();

  return { usuario, proyectoCost };
}
