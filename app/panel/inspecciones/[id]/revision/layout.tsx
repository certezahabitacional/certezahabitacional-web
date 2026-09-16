import { RolUsuario } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function RevisionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  let mostrarAvisoGerenciaV1 = false;
  if (session?.user?.id) {
    const [usuario, inspeccion] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: session.user.id }, select: { rol: true, activo: true } }),
      prisma.inspeccion.findUnique({ where: { id }, select: { numeroInspeccion: true } }),
    ]);
    mostrarAvisoGerenciaV1 = Boolean(
      usuario?.activo && usuario.rol === RolUsuario.GERENTE && inspeccion?.numeroInspeccion === 1,
    );
  }

  return (
    <>
      {mostrarAvisoGerenciaV1 && (
        <div className="bg-slate-950 px-4 pt-6 text-white sm:px-6">
          <div className="mx-auto max-w-5xl rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4 text-sm text-emerald-100">
            <p className="font-black text-emerald-300">Revisión previa de Gerencia · V1</p>
            <p className="mt-1">En una V1, la aprobación de Gerencia no finaliza ni libera el expediente. La autorización final y la emisión del certificado corresponden exclusivamente a Dirección.</p>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
