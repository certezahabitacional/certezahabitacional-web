"use server";

import { EstadoInspeccion, RolUsuario, TipoEvento } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { exigirZonaInspeccionForm } from "@/lib/alcance-zona-inspeccion";
import { validarAjustesParaCertificado } from "@/lib/ajustes-comerciales";
import { asignarInspectorPorInspeccion } from "@/lib/asignar-inspector-por-inspeccion";
import { obtenerAsignacionesInspeccion } from "@/lib/asignaciones-inspeccion";
import { registrarAuditoria } from "@/lib/auditoria";
import { validarLiberacionCampoDesdeCaja } from "@/lib/caja-validaciones";
import { finalizarCapturaMetodoCerteza } from "@/lib/cierre-captura";
import { prisma } from "@/lib/prisma";
import {
  aprobarDireccionMetodoCerteza,
  aprobarGerenciaMetodoCerteza,
  darVistoBuenoCoordinadorMetodoCerteza,
  levantarBloqueoYAprobarMetodoCerteza,
} from "@/lib/revision-certeza-actions";
import {
  devolverACoordinacionPorAsignacion,
  devolverAInspectorPorAsignacion,
} from "@/lib/revision-asignacion-actions";
import { aprobarGerenciaV1SinFinalizar } from "@/lib/revision-v1-gerencia";
import * as legacy from "./actions-legacy";

function inspeccionId(formData: FormData) {
  return String(formData.get("inspeccionId") ?? formData.get("id") ?? "").trim();
}

function errorInicio(id:string,mensaje:string):never{
  redirect(`/panel/inspecciones/${id}?error=${encodeURIComponent(mensaje)}`);
}

export async function asignarInspector(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  const manejadaPorAsignacion = await asignarInspectorPorInspeccion(formData);
  if (!manejadaPorAsignacion) return legacy.asignarInspector(formData);
}
export async function autorizarReasignacionInspector(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.autorizarReasignacionInspector(formData); }
export async function rechazarReasignacionInspector(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.rechazarReasignacionInspector(formData); }
export async function liberarInicioSinPago(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.liberarInicioSinPago(formData); }
export async function crearHallazgo(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.crearHallazgo(formData); }
export async function registrarSeguimientoHallazgo(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.registrarSeguimientoHallazgo(formData); }
export async function actualizarHallazgo(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.actualizarHallazgo(formData); }
export async function finalizarCaptura(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  const manejadaPorMetodo = await finalizarCapturaMetodoCerteza(formData);
  if (!manejadaPorMetodo) return legacy.finalizarCaptura(formData);
}
export async function darVistoBuenoCoordinador(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  const manejadaPorMetodo = await darVistoBuenoCoordinadorMetodoCerteza(formData);
  if (!manejadaPorMetodo) return legacy.darVistoBuenoCoordinador(formData);
}
export async function devolverAInspector(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  const manejadaPorAsignacion = await devolverAInspectorPorAsignacion(formData);
  if (!manejadaPorAsignacion) return legacy.devolverAInspector(formData);
}
export async function aprobarGerencia(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  const manejadaV1 = await aprobarGerenciaV1SinFinalizar(formData);
  if (manejadaV1) return;
  const manejadaPorMetodo = await aprobarGerenciaMetodoCerteza(formData);
  if (!manejadaPorMetodo) return legacy.aprobarGerencia(formData);
}
export async function devolverACoordinacion(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  const manejadaPorAsignacion = await devolverACoordinacionPorAsignacion(formData);
  if (!manejadaPorAsignacion) return legacy.devolverACoordinacion(formData);
}
export async function aprobarDireccion(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  const manejadaPorMetodo = await aprobarDireccionMetodoCerteza(formData);
  if (!manejadaPorMetodo) return legacy.aprobarDireccion(formData);
}
export async function noAprobarDireccion(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.noAprobarDireccion(formData); }
export async function retenerParaAuditoria(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.retenerParaAuditoria(formData); }
export async function levantarBloqueoYAprobar(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  const manejadaPorMetodo = await levantarBloqueoYAprobarMetodoCerteza(formData);
  if (!manejadaPorMetodo) return legacy.levantarBloqueoYAprobar(formData);
}
export async function cambiarEstado(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.cambiarEstado(formData); }

export async function iniciarInspeccion(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  const id=inspeccionId(formData);
  if(!id)redirect("/panel/inspecciones?error=Inspeccion%20no%20valida");

  const session=await auth();
  if(!session?.user)redirect("/login");

  const usuario=await prisma.usuario.findUnique({where:{id:session.user.id},select:{id:true,rol:true,activo:true,inspector:{select:{id:true}}}});
  if(!usuario||!usuario.activo)redirect("/acceso");
  if(usuario.rol!==RolUsuario.DIRECTOR&&usuario.rol!==RolUsuario.INSPECTOR)errorInicio(id,"Solo Dirección o el Inspector asignado pueden iniciar una inspección.");

  const inspeccion=await prisma.inspeccion.findUnique({where:{id},select:{id:true,folio:true,estado:true,cotizacionId:true,inspectorId:true,requiereGerenteZona:true,requiereCoordinador:true,inspector:{select:{usuarioId:true}}}});
  if(!inspeccion)errorInicio(id,"La inspección no existe.");
  if(inspeccion.estado!==EstadoInspeccion.PROGRAMADA)errorInicio(id,"Solo una inspección PROGRAMADA puede iniciarse.");
  if(!inspeccion.inspectorId||!inspeccion.inspector?.usuarioId)errorInicio(id,"La inspección no puede iniciar hasta tener un Inspector asignado.");
  if(usuario.rol===RolUsuario.INSPECTOR&&inspeccion.inspector.usuarioId!==usuario.id)errorInicio(id,"Esta inspección está asignada a otro Inspector.");

  const asignaciones=await obtenerAsignacionesInspeccion(id);
  if(inspeccion.requiereGerenteZona&&!asignaciones.gerenteId)errorInicio(id,"La inspección requiere Gerente y todavía no tiene uno asignado.");
  if(inspeccion.requiereCoordinador&&!asignaciones.coordinadorId)errorInicio(id,"La inspección requiere Coordinador y todavía no tiene uno asignado.");
  if(!inspeccion.cotizacionId)errorInicio(id,"La inspección no tiene una cotización asociada para validar su liberación financiera.");

  const liberacion=await validarLiberacionCampoDesdeCaja(inspeccion.cotizacionId);
  if(!liberacion.ok)errorInicio(id,liberacion.error);

  await prisma.inspeccion.update({where:{id},data:{estado:EstadoInspeccion.EN_PROCESO}});
  await registrarAuditoria({tipo:TipoEvento.EDITAR,entidad:"Inspeccion",entidadId:id,inspeccionId:id,usuarioId:usuario.id,descripcion:`${usuario.rol} inició la inspección ${inspeccion.folio} después de validar equipo asignado y liberación financiera.`});
  revalidatePath(`/panel/inspecciones/${id}`);revalidatePath("/panel/inspecciones");revalidatePath("/panel/agenda");revalidatePath("/panel");
  redirect(`/panel/inspecciones/${id}/captura`);
}

export async function cancelarInspeccion(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.cancelarInspeccion(formData); }
export async function emitirCertificado(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  const id = inspeccionId(formData);
  if (!id) return legacy.emitirCertificado(formData);

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: { numeroInspeccion: true },
  });
  if (inspeccion?.numeroInspeccion === 1) {
    redirect(`/panel/inspecciones/${id}/certificado?error=${encodeURIComponent("En V1 el certificado se genera exclusivamente cuando Dirección autoriza el reporte final.")}`);
  }

  await validarAjustesParaCertificado(id);
  return legacy.emitirCertificado(formData);
}
