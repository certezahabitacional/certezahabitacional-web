import { redirect } from "next/navigation";

export default async function ReporteSeguimientoRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/panel/inspecciones/${id}/reporte-v1`);
}
