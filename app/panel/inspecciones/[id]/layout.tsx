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

      <div className="print:hidden fixed bottom-5 right-5 z-50">
        <Link
          href={`/panel/inspecciones/${id}/instrumentos`}
          className="inline-flex items-center rounded-full border border-cyan-300/30 bg-slate-950/95 px-5 py-3 text-sm font-black text-cyan-300 shadow-2xl backdrop-blur transition hover:bg-slate-900"
        >
          Verificaciones instrumentales
        </Link>
      </div>
    </>
  );
}
