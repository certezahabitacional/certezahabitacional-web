"use server";

import { exigirZonaInspeccionForm } from "@/lib/alcance-zona-inspeccion";
import * as legacy from "./actions-legacy";

export async function cambiarSeleccionEvidencia(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  return legacy.cambiarSeleccionEvidencia(formData);
}

export async function actualizarOrdenEvidencia(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  return legacy.actualizarOrdenEvidencia(formData);
}
