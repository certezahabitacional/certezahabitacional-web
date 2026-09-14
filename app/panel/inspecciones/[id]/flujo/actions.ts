"use server";

import { exigirZonaInspeccionForm } from "@/lib/alcance-zona-inspeccion";
import { finalizarCapturaMetodoCerteza } from "@/lib/cierre-captura";
import * as legacy from "./actions-legacy";

export async function iniciarInspeccionDesdeFlujo(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  return legacy.iniciarInspeccionDesdeFlujo(formData);
}

export async function finalizarCapturaGuiada(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  const manejadaPorMetodo = await finalizarCapturaMetodoCerteza(formData);
  if (!manejadaPorMetodo) return legacy.finalizarCapturaGuiada(formData);
}
