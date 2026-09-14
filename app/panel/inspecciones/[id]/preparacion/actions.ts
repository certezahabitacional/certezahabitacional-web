"use server";

import { exigirZonaInspeccionForm } from "@/lib/alcance-zona-inspeccion";
import * as legacy from "./actions-legacy";

export async function generarGuiaBase(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.generarGuiaBase(formData); }
export async function subirProyecto(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.subirProyecto(formData); }
export async function agregarItemManual(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.agregarItemManual(formData); }
export async function cambiarEstadoItemGuia(formData: FormData) { await exigirZonaInspeccionForm(formData); return legacy.cambiarEstadoItemGuia(formData); }
