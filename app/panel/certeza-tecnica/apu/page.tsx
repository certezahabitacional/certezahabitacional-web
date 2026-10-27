import Link from "next/link";

import { requireCertezaCostAccess } from "@/lib/certeza-tecnica/access";
import { prisma } from "@/lib/prisma";

export default async function APUPage() {
  await requireCertezaCostAccess("/panel/certeza-tecnica/apu");

  const [tarjetas, insumos] = await Promise.all([
    prisma.tarjetaPrecioUnitario.findMany({
      include: {
        proyecto: { select: { codigo: true, nombre: true } },
        concepto: { select: { clave: true, descripcion: true, unidad: true } },
        _count: { select: { componentes: true } },
      },
      orderBy: [{ actualizadoEn: "desc" }],
      take: 50,
    }),
    prisma.insumoAPU.findMany({
      where: { activo: true },
      orderBy: [{ tipo: "asc" }, { descripcion: "asc" }],
      take: 100,
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">Certeza Técnica · Costos y Presupuestos</p>
            <h1 className="mt-2 text-4xl font-black">Tarjetas de Precios Unitarios</h1>
            <p className="mt-3 max-w-4xl text-sm text-slate-400 sm:text-base">
              Integra materiales, mano de obra, equipo, herramienta, subcontratos, rendimientos, indirectos, financiamiento y utilidad por concepto.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/certeza-tecnica/app/costos/generadores" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-cyan-200">Generadores</Link>
            <Link href="/certeza-tecnica/app/costos/presupuestos" className="rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950">Costos y Presupuestos</Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ["Tarjetas APU", tarjetas.length],
            ["Insumos activos", insumos.length],
            ["En borrador", tarjetas.filter((tarjeta) => tarjeta.estado === "BORRADOR").length],
            ["Aprobadas", tarjetas.filter((tarjeta) => tarjeta.estado === "APROBADA").length],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black text-amber-200">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70">
            <div className="border-b border-white/10 px-5 py-4"><h2 className="text-lg font-black">Tarjetas APU</h2></div>
            {tarjetas.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-lg font-black">Todavía no hay tarjetas registradas.</p>
                <p className="mt-2 text-sm text-slate-400">El siguiente paso será crear tarjetas a partir de los conceptos ya cuantificados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full border-collapse text-left">
                  <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <tr><th className="px-4 py-4">Proyecto</th><th className="px-4 py-4">Concepto</th><th className="px-4 py-4">Unidad</th><th className="px-4 py-4">Componentes</th><th className="px-4 py-4">Costo directo</th><th className="px-4 py-4">Precio unitario</th><th className="px-4 py-4">Estado</th></tr>
                  </thead>
                  <tbody>
                    {tarjetas.map((tarjeta) => (
                      <tr key={tarjeta.id} className="border-t border-white/5">
                        <td className="px-4 py-4"><div className="font-mono text-xs text-amber-300">{tarjeta.proyecto.codigo}</div><div className="font-bold">{tarjeta.proyecto.nombre}</div></td>
                        <td className="px-4 py-4"><div className="text-xs text-slate-400">{tarjeta.concepto.clave ?? "Sin clave"}</div><div className="font-bold">{tarjeta.concepto.descripcion}</div></td>
                        <td className="px-4 py-4">{tarjeta.concepto.unidad}</td>
                        <td className="px-4 py-4">{tarjeta._count.componentes}</td>
                        <td className="px-4 py-4">{"$" + Number(tarjeta.costoDirecto).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                        <td className="px-4 py-4 font-black text-emerald-300">{"$" + Number(tarjeta.precioUnitario).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                        <td className="px-4 py-4">{tarjeta.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
            <h2 className="text-lg font-black">Base de insumos</h2>
            <p className="mt-2 text-sm text-slate-400">Catálogo central para reutilizar precios y mantener trazabilidad por fecha y fuente.</p>
            <div className="mt-5 space-y-3">
              {insumos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">Aún no hay insumos cargados.</div>
              ) : (
                insumos.slice(0,20).map((insumo) => (
                  <div key={insumo.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div><div className="text-xs font-black uppercase tracking-wider text-amber-300">{insumo.tipo}</div><div className="mt-1 font-bold">{insumo.descripcion}</div></div>
                      <div className="text-right"><div className="text-xs text-slate-500">{insumo.unidad}</div><div className="font-black">{"$" + Number(insumo.precioBase).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}