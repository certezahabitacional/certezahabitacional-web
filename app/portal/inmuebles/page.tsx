import Link from "next/link";
import { obtenerClienteActual } from "@/lib/cliente-actual";
import { prisma } from "@/lib/prisma";

export default async function PortalInmueblesPage() {
  const cliente = await obtenerClienteActual();

  const inmuebles = await prisma.inmueble.findMany({
    where: {
      clienteId: cliente.id,
    },
    orderBy: {
      creadoEn: "desc",
    },
    include: {
      _count: {
        select: {
          inspecciones: true,
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
          Portal del cliente
        </p>

        <h1 className="mt-2 text-4xl font-black">
          Mis inmuebles
        </h1>

        <p className="mt-2 text-slate-400">
          Consulta los inmuebles asociados a tu cuenta.
        </p>
      </header>

      {inmuebles.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-900 p-10 text-center">
          <h2 className="text-xl font-black">
            No tienes inmuebles registrados
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Cuando se registre un inmueble asociado a tu perfil,
            aparecerá aquí.
          </p>
        </section>
      ) : (
        <section className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {inmuebles.map((inmueble) => (
            <article
              key={inmueble.id}
              className="rounded-3xl border border-white/10 bg-slate-900 p-6"
            >
              <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
                {inmueble.tipo}
              </p>

              <h2 className="mt-3 text-xl font-black">
                {inmueble.alias}
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                {inmueble.direccion}
                {inmueble.colonia
                  ? `, ${inmueble.colonia}`
                  : ""}
                <br />
                {inmueble.ciudad}, {inmueble.estado}
              </p>

              <div className="mt-5 rounded-2xl bg-slate-950 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-600">
                  Inspecciones
                </p>

                <p className="mt-2 text-2xl font-black text-cyan-300">
                  {inmueble._count.inspecciones}
                </p>
              </div>

              <Link
                href="/portal/inspecciones"
                className="mt-5 block rounded-full border border-cyan-300/30 px-5 py-3 text-center text-sm font-black text-cyan-300 hover:bg-cyan-300/10"
              >
                Ver inspecciones
              </Link>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}