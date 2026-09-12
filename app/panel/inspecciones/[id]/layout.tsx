import Link from "next/link";

export default async function InspeccionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      {children}

      <nav className="print:hidden fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 rounded-3xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link
            href={`/panel/inspecciones/${id}/flujo`}
            className="rounded-2xl bg-cyan-300 px-3 py-3 text-center text-xs font-black text-slate-950 sm:text-sm"
          >
            Flujo de campo
          </Link>
          <Link
            href={`/panel/inspecciones/${id}/preparacion`}
            className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-cyan-300 sm:text-sm"
          >
            Guía técnica
          </Link>
          <Link
            href={`/panel/inspecciones/${id}/evidencia-control`}
            className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-amber-300 sm:text-sm"
          >
            Control 4 fotos
          </Link>
          <Link
            href={`/panel/inspecciones/${id}/instrumentos`}
            className="rounded-2xl border border-white/10 px-3 py-3 text-center text-xs font-black text-emerald-300 sm:text-sm"
          >
            Instrumentos
          </Link>
        </div>
      </nav>

      <div className="print:hidden h-28" aria-hidden="true" />
    </>
  );
}
