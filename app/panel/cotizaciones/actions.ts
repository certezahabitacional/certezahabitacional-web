"use server";

import { redirect } from "next/navigation";

/**
 * Compatibilidad temporal con imports históricos.
 * El flujo aprobado se ejecuta desde carga/actions.ts y actions-flujo-aprobado.ts.
 * Estos exports permanecen únicamente para no romper imports antiguos; cualquier
 * invocación queda bloqueada del lado servidor.
 */
function flujoHistoricoBloqueado(): never {
  redirect(
    `/panel/cotizaciones?error=${encodeURIComponent(
      "Esta acción pertenece al flujo histórico y está deshabilitada. Usa el flujo vigente de cotización definitiva, aceptación del cliente y autorización interna.",
    )}`,
  );
}

export async function crearCotizacion(_formData: FormData) {
  flujoHistoricoBloqueado();
}

export async function cambiarEstadoCotizacion(_formData: FormData) {
  flujoHistoricoBloqueado();
}

export async function registrarPrimerPago50(_formData: FormData) {
  flujoHistoricoBloqueado();
}

export async function liquidarCotizacion(_formData: FormData) {
  flujoHistoricoBloqueado();
}

export async function registrarPagoTotal(_formData: FormData) {
  flujoHistoricoBloqueado();
}
