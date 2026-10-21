"use server";

import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { fromZonedTime } from "date-fns-tz";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerUsuarioConAlcanceZona, puedeAccederZona } from "@/lib/alcance-zona";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) { return String(formData.get(campo) ?? "").trim(); }
function volver(tipo: "ok" | "error", mensaje: string): never { redirect(`/panel/agenda?${tipo}=${encodeURIComponent(mensaje)}`); }
async function gestorAgenda() { const usuario=await obtenerUsuarioConAlcanceZona("/panel/agenda"); if(usuario.rol!==RolUsuario.DIRECTOR&&usuario.rol!==RolUsuario.ADMINISTRADOR) redirect("/acceso"); return usuario; }

export async function actualizarAgenda(formData: FormData) {
  const usuario=await gestorAgenda(); const inspeccionId=texto(formData,"inspeccionId"),fechaTexto=texto(formData,"fechaProgramada");
  if(!inspeccionId||!fechaTexto) volver("error","Fecha inválida.");
  const inspeccion=await prisma.inspeccion.findUnique({where:{id:inspeccionId},select:{id:true,folio:true,estado:true,fechaProgramada:true,cotizacionId:true,zonaId:true,zonaHoraria:true,zona:{select:{zonaHoraria:true}}}});
  if(!inspeccion) volver("error","La inspección no existe.");
  if(!puedeAccederZona(usuario,inspeccion.zonaId)) volver("error","No tienes acceso para modificar la agenda de otra zona.");
  // Usar la misma zona que al mostrar Agenda y al crear la inspección.
  const zonaHoraria=inspeccion.zona?.zonaHoraria??inspeccion.zonaHoraria??"America/Ciudad_Juarez";
  const fechaProgramada=fromZonedTime(fechaTexto,zonaHoraria);
  if(Number.isNaN(fechaProgramada.getTime())) volver("error","La fecha agendada no es válida.");
  if(inspeccion.estado!==EstadoInspeccion.PROGRAMADA) {
    volver("error","Agenda solo permite reagendar inspecciones PROGRAMADAS. El inicio, revisión y cierre deben realizarse desde el flujo operativo correspondiente.");
  }
  await prisma.inspeccion.update({where:{id:inspeccionId},data:{fechaProgramada,agendadaPorId:usuario.id}});
  await registrarAuditoria({tipo:TipoEvento.EDITAR,entidad:"Inspeccion",entidadId:inspeccionId,usuarioId:usuario.id,descripcion:`${usuario.rol} reagendó ${inspeccion.folio}: ${inspeccion.fechaProgramada.toISOString()} → ${fechaProgramada.toISOString()}.`});
  revalidatePath("/panel/agenda");revalidatePath("/panel/inspecciones");revalidatePath("/panel/cotizaciones");revalidatePath("/panel/caja");volver("ok","Agenda actualizada correctamente.");
}

export async function agendarCotizacion(_formData: FormData): Promise<never> { await gestorAgenda(); volver("error","La creación de servicios se realiza exclusivamente desde Nueva inspección."); }
