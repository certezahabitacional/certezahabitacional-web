"use server";

import { RolUsuario } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerUsuarioConAlcanceZona } from "@/lib/alcance-zona";
import { ErrorOperacionCaja, autorizarExcepcionCaja, registrarPagoCaja } from "@/lib/caja-operaciones";
import { prisma } from "@/lib/prisma";

function texto(formData: FormData, campo: string) { return String(formData.get(campo) ?? "").trim(); }
function volver(tipo: "ok" | "error", mensaje: string): never { redirect(`/panel/caja?${tipo}=${encodeURIComponent(mensaje)}`); }
async function obtenerUsuarioCaja() {
  const usuario = await obtenerUsuarioConAlcanceZona("/panel/caja");
  if (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR) redirect("/acceso");
  return usuario;
}
function actualizarPantallas(inspeccionId: string | null) {
  for (const ruta of ["/panel/caja", "/panel/caja/historico", "/panel/cotizaciones", "/panel/cotizaciones/visitas", "/panel/inspecciones/nueva", "/panel/inspecciones", "/panel/agenda"]) revalidatePath(ruta);
  if (inspeccionId) revalidatePath(`/panel/inspecciones/${inspeccionId}`);
}

export async function registrarPagoLibre(formData: FormData) {
  const usuario = await obtenerUsuarioCaja();
  let resultado;
  try {
    resultado = await registrarPagoCaja(prisma, { usuarioId: usuario.id, cotizacionId: texto(formData, "cotizacionId"), monto: texto(formData, "monto"), operacionId: texto(formData, "operacionId"), referencia: texto(formData, "referencia"), metodoPago: texto(formData, "metodoPago"), notas: texto(formData, "notas") });
  } catch (error) {
    if (error instanceof ErrorOperacionCaja) volver("error", error.message);
    throw error;
  }
  actualizarPantallas(resultado.inspeccionId);
  volver("ok", resultado.repetido ? "Este pago ya estaba registrado. No se duplicó el abono." : "Pago registrado correctamente.");
}

async function registrarExcepcion(formData: FormData, tipo: "APERTURA" | "INICIO") {
  const usuario = await obtenerUsuarioCaja();
  if (usuario.rol !== RolUsuario.DIRECTOR) volver("error", "Solo Dirección puede autorizar excepciones de pago.");
  let resultado;
  try {
    resultado = await autorizarExcepcionCaja(prisma, { usuarioId: usuario.id, cotizacionId: texto(formData, "cotizacionId"), motivo: texto(formData, "motivo"), tipo });
  } catch (error) {
    if (error instanceof ErrorOperacionCaja) volver("error", error.message);
    throw error;
  }
  actualizarPantallas(resultado.inspeccionId);
  volver("ok", resultado.repetido ? "La excepción ya estaba autorizada; se conservó su registro original." : "Excepción autorizada y registrada correctamente.");
}

export async function autorizarExcepcionApertura(formData: FormData) { await registrarExcepcion(formData, "APERTURA"); }
export async function autorizarExcepcionInicio(formData: FormData) { await registrarExcepcion(formData, "INICIO"); }
