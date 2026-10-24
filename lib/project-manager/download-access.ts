import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const roles=["DIRECTOR","ADMINISTRADOR","GERENTE","COORDINADOR","SUPERVISOR","RESIDENTE","CLIENTE"];

export async function getProjectDownloadAccess(codigo:string){
  const session=await auth();
  if(!session?.user) return null;
  const userId=String((session.user as {id?:string}).id??"");
  if(!userId) return null;

  const usuario=await prisma.usuario.findUnique({
    where:{id:userId},
    select:{rol:true,activo:true,projectManagerAutorizado:true}
  });
  const role=String(usuario?.rol??"");
  if(!usuario?.activo||!usuario.projectManagerAutorizado||!roles.includes(role)) return null;

  const proyecto=await prisma.proyectoPM.findUnique({
    where:{codigo:codigo.toUpperCase()},
    include:{
      participantes:{where:{usuarioId:userId},select:{id:true}},
      constructibilidad:true,
      documentosMaestros:{
        where:{activo:true},
        include:{actividades:{orderBy:{codigo:"asc"}}},
        orderBy:{codigo:"asc"}
      }
    }
  });
  if(!proyecto||!proyecto.activo) return null;
  const global=role==="DIRECTOR"||role==="ADMINISTRADOR";
  if(!global&&proyecto.participantes.length===0) return null;
  return {session,userId,role,proyecto};
}
