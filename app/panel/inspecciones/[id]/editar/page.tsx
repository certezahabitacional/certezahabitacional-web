import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type SearchParams = Promise<{ error?: string }>;

export default async function EditarInspeccionPage({params}:{params:Promise<{id:string}>;searchParams:SearchParams}) {
  const {id}=await params;
  const session=await auth();
  if(!session?.user)redirect("/login");

  const usuarioActual=await prisma.usuario.findUnique({where:{id:session.user.id},select:{id:true,rol:true,activo:true}});
  if(!usuarioActual||!usuarioActual.activo)redirect("/acceso");
  if(usuarioActual.rol!==RolUsuario.ADMINISTRADOR&&usuarioActual.rol!==RolUsuario.DIRECTOR)redirect("/acceso");

  const inspeccion=await prisma.inspeccion.findUnique({where:{id},select:{id:true,estado:true,cotizacionId:true,certificado:{select:{vigente:true}}}});
  if(!inspeccion)notFound();
  if(inspeccion.estado!==EstadoInspeccion.PROGRAMADA){
    redirect(`/panel/inspecciones/${inspeccion.id}?error=${encodeURIComponent("Solo una inspección PROGRAMADA puede reagendarse desde este flujo.")}`);
  }
  if(inspeccion.certificado?.vigente){
    redirect(`/panel/inspecciones/${inspeccion.id}?error=${encodeURIComponent("El expediente tiene un certificado vigente y no puede reagendarse.")}`);
  }
  if(!inspeccion.cotizacionId){
    redirect(`/panel/inspecciones/${inspeccion.id}?error=${encodeURIComponent("La inspección no tiene una cotización vinculada para retomar su programación.")}`);
  }

  redirect(`/panel/inspecciones/nueva?cotizacionId=${encodeURIComponent(inspeccion.cotizacionId)}`);
}
