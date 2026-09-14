"use server";

import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerUsuarioConAlcanceZona, puedeAccederZona } from "@/lib/alcance-zona";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) { return String(formData.get(campo) ?? "").trim(); }
function volver(tipo: "ok" | "error", mensaje: string): never { redirect(`/panel/agenda?${tipo}=${encodeURIComponent(mensaje)}`); }
async function gestorAgenda() { const usuario=await obtenerUsuarioConAlcanceZona("/panel/agenda"); if(usuario.rol!==RolUsuario.DIRECTOR&&usuario.rol!==RolUsuario.ADMINISTRADOR) redirect("/acceso"); return usuario; }

export async function actualizarAgenda(formData: FormData) {
  const usuario=await gestorAgenda(); const inspeccionId=texto(formData,"inspeccionId"),fechaTexto=texto(formData,"fechaProgramada"),estadoTexto=texto(formData,"estado");
  const permitidos:EstadoInspeccion[]=[EstadoInspeccion.PROGRAMADA,EstadoInspeccion.EN_PROCESO,EstadoInspeccion.FINALIZADA];
  if(!inspeccionId||!fechaTexto||!permitidos.includes(estadoTexto as EstadoInspeccion)) volver("error","Fecha o estatus inválidos.");
  const fechaProgramada=new Date(fechaTexto); if(Number.isNaN(fechaProgramada.getTime())) volver("error","La fecha agendada no es válida.");
  const inspeccion=await prisma.inspeccion.findUnique({where:{id:inspeccionId},select:{id:true,folio:true,estado:true,fechaProgramada:true,cotizacionId:true,zonaId:true}});
  if(!inspeccion) volver("error","La inspección no existe.");
  if(!puedeAccederZona(usuario,inspeccion.zonaId)) volver("error","No tienes acceso para modificar la agenda de otra zona.");
  await prisma.inspeccion.update({where:{id:inspeccionId},data:{fechaProgramada,estado:estadoTexto as EstadoInspeccion,agendadaPorId:usuario.id}});
  await registrarAuditoria({tipo:TipoEvento.EDITAR,entidad:"Inspeccion",entidadId:inspeccionId,usuarioId:usuario.id,descripcion:`${usuario.rol} actualizó Agenda de ${inspeccion.folio}: fecha ${inspeccion.fechaProgramada.toISOString()} → ${fechaProgramada.toISOString()}, estatus ${inspeccion.estado} → ${estadoTexto}.`});
  revalidatePath("/panel/agenda");revalidatePath("/panel/inspecciones");revalidatePath("/panel/cotizaciones");revalidatePath("/panel/caja");volver("ok","Agenda actualizada correctamente.");
}

export async function agendarCotizacion(_formData: FormData): Promise<never> { await gestorAgenda(); volver("error","La creación de servicios se realiza exclusivamente desde Nueva inspección."); }
