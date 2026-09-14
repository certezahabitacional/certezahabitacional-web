"use server";

import { exigirZonaInspeccionForm } from "@/lib/alcance-zona-inspeccion";
import * as legacy from "./actions-legacy";

export async function guardarResultadosInstrumentales(formData: FormData) {
  await exigirZonaInspeccionForm(formData);
  return legacy.guardarResultadosInstrumentales(formData);
}
