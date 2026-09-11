import Link from "next/link";
import { EstadoCotizacion, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function dinero(valor: number) {
  return valor.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true },
  });
  if (!usuario?.activo || (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR)) {
    redirect("/acceso");
  }

  const { q = "" } = await searchParams;
  const busqueda = q.trim();
  const cotizaciones = await prisma.cotizacion.findMany({
    where: {
      estado: EstadoCotizacion.AUTORIZADA,
      ...(busqueda ? {
        OR: [
          { folio: { contains: busqueda, mode: "insensitive" } },
          { cliente: { nombre: { contains: busqueda, mode: "insensitive" } } },
          { inmueble: { alias: { contains: busqueda, mode: "insensitive" } } },
        ],
      } : {}),
    },
    select: {
      id: true,
      folio: true,
      total: true,
      montoPagado: true,
      estadoPago: true,
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true } },
      inspeccion: {
        select: {
          inspector: { select: { usuario: { select: { nombre: true } } } },
        },
      },
    },
    orderBy: { autorizadaEn: "desc" },
  });

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <Link href="/panel" className="text-sm font-bold text-cyan-300">← Panel</Link>
        <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-black">Caja</h1>
            <p className="mt-2 text-slate-400">Cotizaciones aceptadas y autorizadas, pagos y saldos pendientes.</p>
          </div>
          <form className="flex gap-2">
            <input name="q" defaultValue={busqueda} placeholder="Folio, cliente o inmueble" className="rounded-full border border-white/10 bg-slate-900 px-5 py-3" />
            <button className="rounded-full border border-white/15 px-5 py-3 font-bold">Filtrar</button>
          </form>
        </div>

        <div className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-slate-900">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-white/10 text-slate-400">
              <tr>
                <th className="p-4">Cotización</th><th className="p-4">Cliente</th><th className="p-4">Inmueble</th><th className="p-4">Inspector</th><th className="p-4 text-right">Importe</th><th className="p-4 text-right">Pagado</th><th className="p-4 text-right">Pendiente</th><th className="p-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {cotizaciones.map((c) => {
                const total = Number(c.total);
                const pagado = Number(c.montoPagado);
                return (
                  <tr key={c.id}>
                    <td className="p-4 font-black text-cyan-300">{c.folio}</td>
                    <td className="p-4">{c.cliente.nombre}</td>
                    <td className="p-4">{c.inmueble?.alias ?? "Por definir"}</td>
                    <td className="p-4">{c.inspeccion?.inspector?.usuario.nombre ?? "Sin asignar"}</td>
                    <td className="p-4 text-right">{dinero(total)}</td>
                    <td className="p-4 text-right text-emerald-300">{dinero(pagado)}</td>
                    <td className="p-4 text-right text-amber-300">{dinero(Math.max(0, total - pagado))}</td>
                    <td className="p-4">{c.estadoPago}</td>
                  </tr>
                );
              })}
              {cotizaciones.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-slate-400">No hay cotizaciones autorizadas con ese filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}