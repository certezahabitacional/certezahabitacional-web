import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ActivadorCamaraRevision } from "./activador-camara";
import { BloqueoSalidaRevision } from "./bloqueo-salida";

export default async function RevisionInicialLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [usuario, inspeccion, fotos] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        rol: true,
        activo: true,
        inspector: { select: { id: true, activo: true } },
      },
    }),
    prisma.inspeccion.findUnique({
      where: { id },
      select: {
        inspectorId: true,
        inspector: { select: { usuarioId: true } },
      },
    }),
    prisma.$queryRaw<Array<{ candidataPortada: boolean }>>`
      SELECT fa."candidataPortada"
      FROM "FotografiaArea" fa
      JOIN "AreaInspeccion" a ON a."id" = fa."areaId"
      WHERE a."inspeccionId" = ${id}
        AND a."codigo" = 'FACHADA_PRINCIPAL'
      ORDER BY fa."orden", fa."creadoEn"
    `,
  ]);

  if (!usuario?.activo || !inspeccion) redirect("/acceso");

  const inspectorAsignado =
    usuario.rol === RolUsuario.INSPECTOR &&
    Boolean(usuario.inspector?.activo) &&
    inspeccion.inspectorId === usuario.inspector?.id &&
    inspeccion.inspector?.usuarioId === usuario.id;
  const director = usuario.rol === RolUsuario.DIRECTOR;
  const responsableCampo = inspectorAsignado || director;
  const fotoDefinitiva = fotos.length === 1 && fotos[0]?.candidataPortada === true;
  const serieEnSitioIniciada = fotos.length > 0 && !fotoDefinitiva;
  const bloquearSalida = responsableCampo && serieEnSitioIniciada;

  return (
    <>
      <ActivadorCamaraRevision activo={responsableCampo && !fotoDefinitiva && fotos.length < 4} />
      <BloqueoSalidaRevision activo={bloquearSalida} />
      {children}
    </>
  );
}
