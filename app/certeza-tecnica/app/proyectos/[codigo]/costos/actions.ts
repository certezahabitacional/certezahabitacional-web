"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectWriteAccess } from "@/lib/project-manager/access";
import { recalcularCostosProyecto } from "@/app/panel/certeza-tecnica/costos/actions";

export async function inicializarCertezaCost(codigo:string){
  const access=await requireProjectWriteAccess(codigo);
  const p=access.proyecto;

  const existente=await prisma.proyectoGeneradores.findUnique({where:{codigo:p.codigo}});
  if(!existente){
    await prisma.proyectoGeneradores.create({
      data:{
        codigo:p.codigo,
        nombre:p.nombre,
        clienteNombre:p.cliente || "Cliente por definir",
        ubicacion:p.ubicacion || null,
        alcance:p.descripcion || "Proyecto vinculado desde Certeza Técnica 360",
        observaciones:"Vinculado automáticamente con Certeza Project Manager por código de proyecto.",
        creadoPorId:access.userId,
        responsableId:access.userId,
      },
    });
  }

  revalidatePath(`/certeza-tecnica/app/proyectos/${p.codigo.toLowerCase()}/costos`);
  revalidatePath(`/certeza-tecnica/app/proyectos/${p.codigo.toLowerCase()}/tablero`);
  revalidatePath(`/project-manager/panel/proyectos/${p.codigo.toLowerCase()}`);
}

export async function recalcularCertezaCostVinculado(codigo:string){
  const access=await requireProjectWriteAccess(codigo);
  const cost=await prisma.proyectoGeneradores.findUnique({where:{codigo:access.proyecto.codigo},select:{id:true}});
  if(!cost) throw new Error("Primero debe inicializar Certeza Cost para este proyecto.");

  await recalcularCostosProyecto(cost.id);

  revalidatePath(`/certeza-tecnica/app/proyectos/${access.proyecto.codigo.toLowerCase()}/costos`);
  revalidatePath(`/certeza-tecnica/app/proyectos/${access.proyecto.codigo.toLowerCase()}/tablero`);
  revalidatePath(`/project-manager/panel/proyectos/${access.proyecto.codigo.toLowerCase()}`);
}
