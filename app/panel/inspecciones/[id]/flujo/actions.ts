"use server";

import { exigirZonaInspeccionForm } from "@/lib/alcance-zona-inspeccion";
import * as legacy from "./actions-legacy";

export async function iniciarInspeccionDesdeFlujo(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  return legacy.iniciarInspeccionDesdeFlujo(formData);
}

export async function finalizarCapturaGuiada(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  return legacy.finalizarCapturaGuiada(formData);
}
