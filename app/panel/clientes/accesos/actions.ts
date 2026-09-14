"use server";

import bcrypt from "bcryptjs";
import { RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { obtenerUsuarioConAlcanceZona, puedeAccederZona } from "@/lib/alcance-zona";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

const schema=z.object({clienteId:z.string().trim().min(1),email:z.string().trim().email("El correo electrónico no es válido."),password:z.string().min(8,"La contraseña debe tener al menos 8 caracteres.")});
async function obtenerGestor(){const gestor=await obtenerUsuarioConAlcanceZona("/panel/clientes/accesos");if(gestor.rol!==RolUsuario.DIRECTOR&&gestor.rol!==RolUsuario.ADMINISTRADOR)redirect("/acceso");return gestor;}
function volver(tipo:"ok"|"error",mensaje:string):never{redirect(`/panel/clientes/accesos?${tipo}=${encodeURIComponent(mensaje)}`);}

export async function asignarAccesoCliente(formData:FormData){
  const gestor=await obtenerGestor();
  const resultado=schema.safeParse({clienteId:String(formData.get("clienteId")??"").trim(),email:String(formData.get("email")??"").trim().toLowerCase(),password:String(formData.get("password")??"")});
  if(!resultado.success)volver("error",resultado.error.issues[0]?.message??"Datos inválidos.");
  const {clienteId,email,password}=resultado.data;
  const cliente=await prisma.cliente.findUnique({where:{id:clienteId},select:{id:true,nombre:true,usuarioId:true,usuario:{select:{id:true,email:true,rol:true,zonaId:true}},cotizaciones:{where:{zonaId:{not:null}},select:{zonaId:true},orderBy:{creadoEn:"desc"}},inspecciones:{where:{zonaId:{not:null}},select:{zonaId:true},orderBy:{creadoEn:"desc"}}}});
  if(!cliente)volver("error","El cliente no existe.");
  const zonasCliente=Array.from(new Set([...cliente.cotizaciones.map(c=>c.zonaId),...cliente.inspecciones.map(i=>i.zonaId)].filter((z):z is string=>Boolean(z))));
  if(zonasCliente.length===0)volver("error","El cliente todavía no tiene una zona operativa asociada. Completa primero su pre-cotización.");
  if(zonasCliente.length>1)volver("error","El cliente tiene operaciones en más de una zona. Dirección debe resolver su alcance antes de crear una cuenta de acceso única.");
  const zonaId=zonasCliente[0];
  if(!puedeAccederZona(gestor,zonaId))volver("error","No puedes asignar acceso a un cliente de otra zona.");
  const correoEnUso=await prisma.usuario.findUnique({where:{email},select:{id:true}});if(correoEnUso&&correoEnUso.id!==cliente.usuarioId)volver("error","Ese correo ya pertenece a otro usuario del sistema.");
  const passwordHash=await bcrypt.hash(password,12);
  if(cliente.usuarioId){await prisma.usuario.update({where:{id:cliente.usuarioId},data:{nombre:cliente.nombre,email,passwordHash,rol:RolUsuario.CLIENTE,zonaId,activo:true,requiereCambioPassword:true,intentosFallidos:0,bloqueadoHasta:null}});}else{await prisma.$transaction(async tx=>{const usuario=await tx.usuario.create({data:{nombre:cliente.nombre,email,passwordHash,rol:RolUsuario.CLIENTE,zonaId,activo:true,requiereCambioPassword:true}});await tx.cliente.update({where:{id:cliente.id},data:{usuarioId:usuario.id}});});}
  await registrarAuditoria({tipo:TipoEvento.EDITAR,entidad:"Cliente",entidadId:cliente.id,usuarioId:gestor.id,descripcion:`${gestor.rol} asignó o restableció el acceso del cliente ${cliente.nombre} en zona ${zonaId}.`});
  revalidatePath("/panel/clientes");revalidatePath("/panel/clientes/accesos");revalidatePath("/portal");volver("ok","Acceso del cliente actualizado con alcance de zona. Deberá cambiar su contraseña en el primer ingreso.");
}
