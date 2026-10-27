import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
