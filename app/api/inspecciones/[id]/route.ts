import { NextResponse } from "next/server";

import { validarZonaInspeccionApi } from "@/lib/alcance-zona-inspeccion";
import * as legacy from "./route-legacy";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Contexto) {
  const { id } = await context.params;
  const acceso = await validarZonaInspeccionApi(id);
  if (!acceso.ok) {
    return NextResponse.json({ error: acceso.error }, { status: acceso.status });
  }
  return legacy.GET(request, context);
}
