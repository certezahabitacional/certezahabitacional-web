import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";
import { obtenerUsuarioConAlcanceZona, puedeAccederZona } from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";
import { consultarVinculoVisita } from "@/lib/visitas-cotizacion";
import { ErrorContratoVisita } from "@/lib/visitas-contrato";
import NuevaInspeccionBase from "./page-base";

type Params = { error?: string; antecedenteId?: string; cotizacionId?: string };
export default async function NuevaInspeccionPage({ searchParams }: { searchParams: Promise<Params> }) {
  const usuario = await obtenerUsuarioConAlcanceZona("/panel/inspecciones/nueva");
  if (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR) redirect("/acceso");
  let params = await searchParams;
  if (params.cotizacionId) {
    const cotizacion = await prisma.cotizacion.findUnique({ where: { id: params.cotizacionId }, select: { zonaId: true } });
    if (cotizacion && !puedeAccederZona(usuario, cotizacion.zonaId)) redirect("/acceso");
    try {
      const vinculo = cotizacion ? await consultarVinculoVisita(prisma, params.cotizacionId) : null;
      if (vinculo) params = { ...params, antecedenteId: vinculo.inspeccionAnteriorId };
    } catch (error) {
      if (!(error instanceof ErrorContratoVisita)) throw error;
      return <main className="min-h-screen bg-slate-950 p-8 text-white"><h1 className="text-2xl font-bold">Revisión del expediente de seguimiento</h1><p role="alert" className="mt-4 text-amber-200">{error.message}</p><p className="mt-3 text-slate-300">No se creó ni se modificó ninguna inspección.</p><Link href="/panel/cotizaciones/visitas" className="mt-5 inline-block text-cyan-300">Volver a visitas contratadas</Link></main>;
    }
  }
  return <NuevaInspeccionBase searchParams={Promise.resolve(params)} />;
}
