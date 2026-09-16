import { bloquearContenidoTecnicoV1Finalizado } from "@/lib/acceso-v1-final";

export default async function PreReporteV1Layout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  await bloquearContenidoTecnicoV1Finalizado(id);
  return children;
}
