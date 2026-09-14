"use server";

import { exigirZonaInspeccionForm } from "@/lib/alcance-zona-inspeccion";
import * as legacy from "./actions-legacy";

export async function actualizarInspeccion(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  return legacy.actualizarInspeccion(formData);
}
