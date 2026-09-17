import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ActivadorCamaraRevision } from "./activador-camara";
import { eliminarFotoGaleriaFachada } from "./archivo-actions";
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
    prisma.$queryRaw<Array<{ fotografiaId: string; candidataPortada: boolean; origen: string | null }>>`
      SELECT fa."fotografiaId", fa."candidataPortada", a."origen"::text AS "origen"
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
  const fotoGaleriaDefinitiva =
    responsableCampo && fotoDefinitiva && fotos[0]?.origen === "ARCHIVO_EXISTENTE" ? fotos[0] : null;

  return (
    <>
      <ActivadorCamaraRevision activo={responsableCampo && !fotoDefinitiva && fotos.length < 4} />
      <BloqueoSalidaRevision activo={bloquearSalida} />
      {fotoGaleriaDefinitiva && (
        <div className="mx-auto mt-4 w-[calc(100%-2rem)] max-w-5xl rounded-2xl border border-amber-300/30 bg-amber-300/10 px-5 py-4 text-sm text-amber-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black">FOTOGRAFÍA CARGADA DESDE GALERÍA</p>
              <p className="mt-1 leading-6">
                Mientras la inspección siga PROGRAMADA puedes quitar esta fotografía y seleccionar otra, o cambiar a la ruta de 4 fotos en sitio.
              </p>
            </div>
            <form action={eliminarFotoGaleriaFachada}>
              <input type="hidden" name="inspeccionId" value={id} />
              <input type="hidden" name="fotografiaId" value={fotoGaleriaDefinitiva.fotografiaId} />
              <button className="w-full rounded-xl border border-amber-200/40 px-4 py-3 text-xs font-black text-amber-100 sm:w-auto">
                QUITAR / CAMBIAR FOTO
              </button>
            </form>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
