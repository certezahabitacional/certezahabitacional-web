"use server";

import { EstadoInspeccion, RolUsuario } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  extraerConfiguracionHerramientas,
  obtenerHerramientas,
  type ResultadosInstrumentales,
} from "@/lib/herramientas-inspeccion";
import {
  extraerResultadosInstrumentales,
  serializarResultadosInstrumentales,
} from "@/lib/resultados-instrumentales";
import { prisma } from "@/lib/prisma";

function volver(id: string, mensaje: string, tipo: "ok" | "error"): never {
  redirect(
    `/panel/inspecciones/${id}/instrumentos?${tipo}=${encodeURIComponent(mensaje)}`,
  );
}

export async function guardarResultadosInstrumentales(formData: FormData) {
  const session = await auth();

  if (!session?.user) redirect("/login");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/panel/inspecciones");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      rol: true,
      activo: true,
      inspector: { select: { id: true, activo: true } },
    },
  });

  if (!usuario?.activo) redirect("/acceso");

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: {
      id: true,
      estado: true,
      inspectorId: true,
      observaciones: true,
      cotizacion: {
        select: {
          observacionesInternas: true,
        },
      },
    },
  });

  if (!inspeccion) volver(id, "La inspección no existe.", "error");

  const esInspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    inspeccion.inspectorId === usuario.inspector?.id;

  const puedeEditar =
    esInspectorAsignado || usuario.rol === RolUsuario.DIRECTOR;

  if (!puedeEditar) redirect("/acceso");

  if (inspeccion.estado !== EstadoInspeccion.EN_PROCESO) {
    volver(
      id,
      "Los resultados instrumentales solo pueden capturarse mientras la inspección está EN PROCESO.",
      "error",
    );
  }

  const configuracion = extraerConfiguracionHerramientas(
    inspeccion.cotizacion?.observacionesInternas,
  );
  const herramientas = obtenerHerramientas(configuracion.herramientas);

  if (herramientas.length === 0) {
    volver(
      id,
      "La cotización no incluye herramientas o pruebas instrumentales.",
      "error",
    );
  }

  const resultados: ResultadosInstrumentales = {};

  for (const herramienta of herramientas) {
    const estadoRaw = String(
      formData.get(`estado__${herramienta.codigo}`) ?? "REALIZADA",
    );
    const estado =
      estadoRaw === "NO_EJECUTADA" ? "NO_EJECUTADA" : "REALIZADA";

    const valores: Record<string, string> = {};

    for (const campo of herramienta.campos) {
      valores[campo.clave] = String(
        formData.get(`${herramienta.codigo}__${campo.clave}`) ?? "",
      ).trim();
    }

    resultados[herramienta.codigo] = {
      estado,
      valores,
      motivoNoEjecutada: String(
        formData.get(`motivo__${herramienta.codigo}`) ?? "",
      ).trim() || undefined,
    };
  }

  const { textoLibre } = extraerResultadosInstrumentales(
    inspeccion.observaciones,
  );

  await prisma.inspeccion.update({
    where: { id },
    data: {
      observaciones: serializarResultadosInstrumentales(
        resultados,
        textoLibre,
      ),
    },
  });

  revalidatePath(`/panel/inspecciones/${id}`);
  revalidatePath(`/panel/inspecciones/${id}/captura`);
  revalidatePath(`/panel/inspecciones/${id}/reporte`);
  revalidatePath(`/panel/inspecciones/${id}/instrumentos`);

  volver(id, "Resultados instrumentales guardados.", "ok");
}
