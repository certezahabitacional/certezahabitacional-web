"use server";

import { exigirZonaInspeccionForm } from "@/lib/alcance-zona-inspeccion";
import { validarAjustesParaCertificado } from "@/lib/ajustes-comerciales";
import * as legacy from "./actions-legacy";

function inspeccionId(formData: FormData) {
  return String(formData.get("inspeccionId") ?? "").trim();
}

export async function asignarInspector(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.asignarInspector(formData); }
export async function autorizarReasignacionInspector(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.autorizarReasignacionInspector(formData); }
export async function rechazarReasignacionInspector(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.rechazarReasignacionInspector(formData); }
export async function liberarInicioSinPago(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.liberarInicioSinPago(formData); }
export async function crearHallazgo(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.crearHallazgo(formData); }
export async function registrarSeguimientoHallazgo(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.registrarSeguimientoHallazgo(formData); }
export async function actualizarHallazgo(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.actualizarHallazgo(formData); }
export async function finalizarCaptura(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.finalizarCaptura(formData); }
export async function darVistoBuenoCoordinador(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.darVistoBuenoCoordinador(formData); }
export async function devolverAInspector(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.devolverAInspector(formData); }
export async function aprobarGerencia(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.aprobarGerencia(formData); }
export async function devolverACoordinacion(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.devolverACoordinacion(formData); }
export async function aprobarDireccion(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.aprobarDireccion(formData); }
export async function noAprobarDireccion(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.noAprobarDireccion(formData); }
export async function retenerParaAuditoria(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.retenerParaAuditoria(formData); }
export async function levantarBloqueoYAprobar(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.levantarBloqueoYAprobar(formData); }
export async function cambiarEstado(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.cambiarEstado(formData); }
export async function iniciarInspeccion(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.iniciarInspeccion(formData); }
export async function cancelarInspeccion(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.cancelarInspeccion(formData); }
export async function emitirCertificado(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  const id = inspeccionId(formData);
  if (id) await validarAjustesParaCertificado(id);
  return legacy.emitirCertificado(formData);
}
