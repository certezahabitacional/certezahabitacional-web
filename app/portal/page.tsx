import Link from "next/link";
import { obtenerClienteActual } from "@/lib/cliente-actual";
import { prisma } from "@/lib/prisma";

export default async function PortalPage() {
  const cliente = await obtenerClienteActual();

  const [
    inspecciones,
    inmuebles,
    certificados,
    recientes,
  ] = await Promise.all([
    prisma.inspeccion.count({
      where: {
        clienteId: cliente.id,
      },
    }),

    prisma.inmueble.count({
      where: {
        clienteId: cliente.id,
      },
    }),

    prisma.certificado.count({
      where: {
        inspeccion: {
          clienteId: cliente.id,
        },
      },
    }),

    prisma.inspeccion.findMany({
      where: {
        clienteId: cliente.id,
      },
      include: {
        certificado: true,
      },
      orderBy: {
        actualizadoEn: "desc",
      },
      take: 5,
    }),
  ]);

  return (
    <main className="px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] bg-cyan-300 p-8 text-slate-950">
          <p className="text-sm font-black uppercase tracking-[0.25em]">
            Bienvenido
          </p>

          <h1 className="mt-3 text-4xl font-black">
            {cliente.nombre}
          </h1>

          <p className="mt-3 max-w-2xl text-slate-800">
            Consulta el avance de tus inspecciones, reportes,
            certificados e inmuebles registrados.
          </p>
        </section>

        <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Metrica
            titulo="Inspecciones"
            valor={inspecciones}
          />

          <Metrica
            titulo="Inmuebles"
            valor={inmuebles}
          />

          <Metrica
            titulo="Certificados"
            valor={certificados}
          />
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
          <header className="flex items-center justify-between border-b border-white/10 p-6">
            <div>
              <h2 className="text-xl font-black">
                Actividad reciente
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Tus últimas inspecciones actualizadas.
              </p>
            </div>

            <Link
              href="/portal/inspecciones"
              className="text-sm font-bold text-cyan-300"
            >
              Ver todas →
            </Link>
          </header>

          {recientes.length === 0 ? (
            <p className="p-10 text-center text-slate-500">
              Todavía no tienes inspecciones registradas.
            </p>
          ) : (
            <div className="divide-y divide-white/10">
              {recientes.map((inspeccion) => (
                <Link
                  key={inspeccion.id}
                  href={`/portal/inspecciones/${inspeccion.id}`}
                  className="grid gap-4 p-6 transition hover:bg-white/[0.03] md:grid-cols-[1fr_1fr_auto]"
                >
                  <div>
                    <p className="font-black text-cyan-300">
                      {inspeccion.folio}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {inspeccion.direccion}
                    </p>
                  </div>

                  <div>
                    <p className="font-bold">
                      {inspeccion.tipoServicio}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {inspeccion.estado.replaceAll("_", " ")}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-black">
                      {inspeccion.ish !== null
                        ? `${Math.round(Number(inspeccion.ish))}/100`
                        : "Sin evaluar"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {inspeccion.certificado
                        ? "Certificado disponible"
                        : "Sin certificado"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metrica({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900 p-6">
      <p className="text-sm font-bold text-slate-400">
        {titulo}
      </p>

      <p className="mt-4 text-4xl font-black text-cyan-300">
        {String(valor).padStart(2, "0")}
      </p>
    </article>
  );
}