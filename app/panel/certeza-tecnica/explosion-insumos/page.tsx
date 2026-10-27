import Link from "next/link";

import { requireCertezaCostAccess } from "@/lib/certeza-tecnica/access";
import { prisma } from "@/lib/prisma";

export default async function ExplosionInsumosPage() {
  await requireCertezaCostAccess("/panel/certeza-tecnica/explosion-insumos");

  const explosiones = await prisma.explosionInsumosProyecto.findMany({
    include: {
      proyecto: { select: { codigo: true, nombre: true, clienteNombre: true } },
      _count: { select: { detalles: true } },
    },
    orderBy: [{ actualizadoEn: "desc" }],
    take: 50,
  });

  const totales = explosiones.reduce((acc, item) => {
    acc.materiales += Number(item.totalMateriales);
    acc.manoObra += Number(item.totalManoObra);
    acc.equipo += Number(item.totalEquipo);
    acc.total += Number(item.totalGeneral);
    return acc;
  }, { materiales: 0, manoObra: 0, equipo: 0, total: 0 });

  const money = (value: number) => "$" + value.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">Certeza Técnica · Costos y Presupuestos</p>
            <h1 className="mt-2 text-4xl font-black">Explosión de Insumos</h1>
            <p className="mt-3 max-w-4xl text-sm text-slate-400 sm:text-base">Consolida automáticamente los insumos de las tarjetas APU para conocer cantidades y costos globales del proyecto.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/panel/certeza-tecnica/generadores" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-cyan-200">Generadores</Link>
            <Link href="/panel/certeza-tecnica/apu" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-cyan-200">Tarjetas APU</Link>
            <Link href="/certeza-tecnica/presupuestos-costos" className="rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950">Costos y Presupuestos</Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ["Explosiones", explosiones.length],
            ["Materiales", money(totales.materiales)],
            ["Mano de obra", money(totales.manoObra)],
            ["Total consolidado", money(totales.total)],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-amber-200">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-lg font-black">Consolidado por proyecto</h2>
          </div>

          {explosiones.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-lg font-black">Todavía no hay explosiones de insumos generadas.</p>
              <p className="mt-2 text-sm text-slate-400">Se generarán a partir de conceptos cuantificados y Tarjetas APU aprobadas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full border-collapse text-left">
                <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-4">Proyecto</th>
                    <th className="px-4 py-4">Cliente</th>
                    <th className="px-4 py-4">Versión</th>
                    <th className="px-4 py-4">Materiales</th>
                    <th className="px-4 py-4">Mano de obra</th>
                    <th className="px-4 py-4">Equipo</th>
                    <th className="px-4 py-4">Herramienta</th>
                    <th className="px-4 py-4">Subcontratos</th>
                    <th className="px-4 py-4">Auxiliares</th>
                    <th className="px-4 py-4">Total</th>
                    <th className="px-4 py-4">Insumos</th>
                  </tr>
                </thead>
                <tbody>
                  {explosiones.map((item) => (
                    <tr key={item.id} className="border-t border-white/5">
                      <td className="px-4 py-4"><div className="font-mono text-xs text-amber-300">{item.proyecto.codigo}</div><div className="font-bold">{item.proyecto.nombre}</div></td>
                      <td className="px-4 py-4">{item.proyecto.clienteNombre}</td>
                      <td className="px-4 py-4">v{item.version}</td>
                      <td className="px-4 py-4">{money(Number(item.totalMateriales))}</td>
                      <td className="px-4 py-4">{money(Number(item.totalManoObra))}</td>
                      <td className="px-4 py-4">{money(Number(item.totalEquipo))}</td>
                      <td className="px-4 py-4">{money(Number(item.totalHerramienta))}</td>
                      <td className="px-4 py-4">{money(Number(item.totalSubcontratos))}</td>
                      <td className="px-4 py-4">{money(Number(item.totalAuxiliares))}</td>
                      <td className="px-4 py-4 font-black text-emerald-300">{money(Number(item.totalGeneral))}</td>
                      <td className="px-4 py-4">{item._count.detalles}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-6">
          <h2 className="text-xl font-black text-amber-200">Lógica del módulo</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {["Cantidades de obra","Tarjetas APU","Agrupación por insumo","Costo consolidado","Base para presupuesto"].map((label, index) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <div className="text-xs font-black text-amber-300">0{index + 1}</div>
                <div className="mt-2 font-black">{label}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}