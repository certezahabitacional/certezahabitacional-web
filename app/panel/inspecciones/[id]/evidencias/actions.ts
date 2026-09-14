"use server";

import { exigirZonaInspeccionForm } from "@/lib/alcance-zona-inspeccion";
import * as legacy from "./actions-legacy";

export async function registrarEvidencia(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  return legacy.registrarEvidencia(formData);
}

export async function eliminarEvidencia(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  return legacy.eliminarEvidencia(formData);
}
