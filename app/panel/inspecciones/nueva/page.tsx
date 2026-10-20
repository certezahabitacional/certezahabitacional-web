import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";
import { obtenerUsuarioConAlcanceZona, puedeAccederZona } from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";
import { consultarVinculoVisita } from "@/lib/visitas-cotizacion";
import NuevaInspeccionBase from "./page-base";

type Params = { error?: string; antecedenteId?: string; cotizacionId?: string };
export default async function NuevaInspeccionPage({ searchParams }: { searchParams: Promise<Params> }) {
  const usuario = await obtenerUsuarioConAlcanceZona("/panel/inspecciones/nueva");
  if (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR) redirect("/acceso");
  let params = await searchParams;
  if (params.cotizacionId) {
    const cotizacion = await prisma.cotizacion.findUnique({ where: { id: params.cotizacionId }, select: { zonaId: true } });
    if (cotizacion && !puedeAccederZona(usuario, cotizacion.zonaId)) redirect("/acceso");
    const vinculo = cotizacion ? await consultarVinculoVisita(prisma, params.cotizacionId) : null;
    if (vinculo) params = { ...params, antecedenteId: vinculo.inspeccionAnteriorId };
  }
  return <NuevaInspeccionBase searchParams={Promise.resolve(params)} />;
}
