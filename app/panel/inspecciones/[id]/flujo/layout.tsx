import Link from "next/link";

import { prisma } from "@/lib/prisma";

export default async function FlujoLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: { numeroInspeccion: true },
  });
  const esV1 = inspeccion?.numeroInspeccion === 1;

  return (
    <>
      {esV1 && (
        <div className="bg-slate-950 px-5 pt-5 text-right">
          <Link
            href={`/panel/inspecciones/${id}/proyecto-v1`}
            className="inline-block rounded-full border border-violet-300/30 px-4 py-2 text-sm font-black text-violet-200"
          >
            Proyecto PDF · IA
          </Link>
        </div>
      )}
      {children}
    </>
  );
}
