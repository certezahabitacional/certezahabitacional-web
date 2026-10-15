import { redirect } from "next/navigation";

// La planeacion fue retirada del flujo. Conservamos la ruta antigua
// para llevar enlaces previos directamente a la inspeccion.
export default async function PlanInspeccionRetirada({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/panel/inspecciones/${id}/campo-v1`);
}
