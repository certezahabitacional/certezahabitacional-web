import { NextResponse } from "next/server";

import { validarZonaInspeccionApi } from "@/lib/alcance-zona-inspeccion";
import * as legacy from "./route-legacy";

type Contexto = { params: Promise<{ id: string }> };

async function validar(context: Contexto) {
  const { id } = await context.params;
  return validarZonaInspeccionApi(id);
}

export async function GET(request: Request, context: Contexto) {
  const acceso = await validar(context);
  if (!acceso.ok) {
    return NextResponse.json({ error: acceso.error }, { status: acceso.status });
  }
  return legacy.GET(request, context);
}

export async function POST(request: Request, context: Contexto) {
  const acceso = await validar(context);
  if (!acceso.ok) {
    return NextResponse.json({ error: acceso.error }, { status: acceso.status });
  }
  return legacy.POST(request, context);
}
