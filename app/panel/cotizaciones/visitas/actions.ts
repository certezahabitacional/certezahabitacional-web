"use server";
import { Prisma, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { obtenerUsuarioConAlcanceZona } from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";
import { contratarVisita } from "@/lib/visitas-cotizacion";
import { ErrorContratoVisita } from "@/lib/visitas-contrato";

export type EstadoHabilitacion = { error: string | null };
export async function habilitarVisita(_estado: EstadoHabilitacion, form: FormData): Promise<EstadoHabilitacion> {
  const usuario = await obtenerUsuarioConAlcanceZona("/panel/cotizaciones/visitas");
  if (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR) redirect("/acceso");
  if (process.env.CH_VISITAS_CONTRATADAS !== "1") return { error: "La habilitación de visitas aún no está activada en este ambiente." };
  let resultado;
  try {
    resultado = await contratarVisita(prisma, {
      usuarioId: usuario.id,
      cotizacionId: String(form.get("cotizacionId") ?? "").trim(),
      inspeccionAnteriorId: String(form.get("inspeccionAnteriorId") ?? "").trim(),
      importeContratado: form.get("importeContratado"),
      motivo: form.get("motivo"),
      confirmada: form.get("confirmarContratacion") === "on",
    });
  } catch (error) {
    if (error instanceof ErrorContratoVisita) return { error: error.message };
    console.error("[visitas] No se pudo completar la habilitacion", error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "UNEXPECTED");
    return { error: "No se pudo confirmar la habilitación. Revisa el expediente antes de reintentar; no vuelvas a capturar pagos de V1." };
  }
  revalidatePath("/panel/cotizaciones");
  revalidatePath("/panel/cotizaciones/visitas");
  revalidatePath("/panel/caja");
  revalidatePath("/panel/inspecciones/nueva");
  const mensaje = resultado.yaExistia ? "La visita ya existía; no se duplicó ni se modificó su importe." : "Visita habilitada con importe propio. Registra sus pagos en Caja para agendar al 50% e iniciar al 100%.";
  redirect(`/panel/caja?q=${encodeURIComponent(resultado.folio)}&ok=${encodeURIComponent(mensaje)}`);
}
