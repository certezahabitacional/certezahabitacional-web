"use server";
import { Prisma, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";
import { obtenerUsuarioConAlcanceZona, puedeAccederZona } from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";
import { consultarVinculoVisita } from "@/lib/visitas-cotizacion";
import { ErrorContratoVisita } from "@/lib/visitas-contrato";
import { crearInspeccion as crearInspeccionBase } from "./actions-base";

export async function crearInspeccion(formData: FormData) {
  const usuario = await obtenerUsuarioConAlcanceZona("/panel/inspecciones/nueva");
  if (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR) redirect("/acceso");
  const cotizacionId = String(formData.get("cotizacionId") ?? "").trim();
  const cotizacion = cotizacionId ? await prisma.cotizacion.findUnique({ where: { id: cotizacionId }, select: { zonaId: true, clienteId: true, inmuebleId: true } }) : null;
  if (cotizacion && !puedeAccederZona(usuario, cotizacion.zonaId)) redirect("/acceso");
  let vinculo: Awaited<ReturnType<typeof consultarVinculoVisita>> = null;
  try { vinculo = cotizacion ? await consultarVinculoVisita(prisma, cotizacionId) : null; }
  catch (error) {
    if (error instanceof ErrorContratoVisita) redirect(`/panel/inspecciones/nueva?error=${encodeURIComponent(error.message)}`);
    throw error;
  }
  if (vinculo) {
    const antecedente = await prisma.inspeccion.findUnique({ where: { id: vinculo.inspeccionAnteriorId }, select: { id: true, numeroInspeccion: true, clienteId: true, inmuebleId: true, zonaId: true, estado: true, liberacionBloqueada: true, revisiones: { where: { rol: RolUsuario.DIRECTOR, decision: "APROBADO", estado: "VIGENTE" }, select: { id: true }, take: 1 } } });
    if (!antecedente || antecedente.numeroInspeccion + 1 !== vinculo.numeroVisita || antecedente.clienteId !== cotizacion!.clienteId || antecedente.inmuebleId !== cotizacion!.inmuebleId || antecedente.zonaId !== cotizacion!.zonaId || antecedente.estado !== "FINALIZADA" || antecedente.liberacionBloqueada || !antecedente.revisiones.length) redirect(`/panel/inspecciones/nueva?error=${encodeURIComponent("El antecedente de la visita no está autorizado o no coincide con el expediente.")}`);
    const solicitado = String(formData.get("antecedenteId") ?? "");
    if (solicitado && solicitado !== antecedente.id) redirect("/acceso");
    formData.set("antecedenteId", antecedente.id);
    formData.set("clienteId", cotizacion!.clienteId);
    formData.set("inmuebleId", cotizacion!.inmuebleId!);
  }
  try { await crearInspeccionBase(formData); }
  catch (error) {
    if (vinculo && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existente = await prisma.inspeccion.findUnique({ where: { cotizacionId }, select: { id: true, inspeccionAnteriorId: true } });
      if (existente?.inspeccionAnteriorId === vinculo.inspeccionAnteriorId) redirect(`/panel/inspecciones/${existente.id}`);
    }
    throw error; // Incluye NEXT_REDIRECT; nunca convertirlo en error de guardado.
  }
}
