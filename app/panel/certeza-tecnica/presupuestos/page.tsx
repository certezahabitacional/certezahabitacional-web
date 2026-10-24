import Link from "next/link";
import { RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona } from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";
import { recalcularCostosProyecto } from "@/app/panel/certeza-tecnica/costos/actions";

export default async function PresupuestosCTPage() {
  const usuarioActual = await obtenerUsuarioConAlcanceZona("/panel/certeza-tecnica/presupuestos");
  const puedeEntrar = usuarioActual.rol === RolUsuario.DIRECTOR || usuarioActual.rol === RolUsuario.ADMINISTRADOR;
  if (!puedeEntrar) redirect("/acceso");

  const [presupuestos, proyectosCosteables] = await Promise.all([prisma.presupuestoProyectoCT.findMany({
    include: {
      proyecto: { select: { codigo: true, nombre: true, clienteNombre: true } },
      _count: { select: { conceptos: true } },
    },
    orderBy: [{ actualizadoEn: "desc" }],
    take: 50,
  }),
    prisma.proyectoGeneradores.findMany({
      select: { id: true, codigo: true, nombre: true },
      orderBy: [{ actualizadoEn: "desc" }],
      take: 100,
    }),
  ]);

  const money = (value: number) => "$" + value.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});
  const totalGeneral = presupuestos.reduce((s, p) => s + Number(p.totalPresupuesto), 0);
  const totalDirecto = presupuestos.reduce((s, p) => s + Number(p.costoDirecto), 0);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">Certeza Técnica · Costos y Presupuestos</p>
            <h1 className="mt-2 text-4xl font-black">Presupuestos</h1>
            <p className="mt-3 max-w-4xl text-sm text-slate-400 sm:text-base">
              Integra cantidades, precios unitarios y cargos para formar el presupuesto base, sus versiones y la futura línea de control del proyecto.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/panel/certeza-tecnica/generadores" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-cyan-200">Generadores</Link>
            <Link href="/panel/certeza-tecnica/apu" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-cyan-200">Tarjetas APU</Link>
            <Link href="/panel/certeza-tecnica/explosion-insumos" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-cyan-200">Explosión de Insumos</Link>
            <Link href="/certeza-tecnica/presupuestos-costos" className="rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950">Costos y Presupuestos</Link>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-6">
          <h2 className="text-xl font-black text-cyan-200">Recálculo automático del sistema de costos</h2>
          <p className="mt-2 text-sm text-slate-300">
            Genera o actualiza automáticamente la explosión de insumos y el presupuesto usando generadores aprobados y Tarjetas APU aprobadas.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {proyectosCosteables.map((proyecto) => (
              <form
                key={proyecto.id}
                action={async () => {
                  "use server";
                  await recalcularCostosProyecto(proyecto.id);
                }}
                className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4"
              >
                <div>
                  <div className="font-mono text-xs font-black text-amber-300">{proyecto.codigo}</div>
                  <div className="mt-1 font-bold">{proyecto.nombre}</div>
                </div>
                <button type="submit" className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 hover:bg-cyan-200">
                  Recalcular
                </button>
              </form>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ["Presupuestos", presupuestos.length],
            ["Costo directo", money(totalDirecto)],
            ["Total presupuestado", money(totalGeneral)],
            ["Líneas base", presupuestos.filter((p) => p.estado === "LINEA_BASE").length],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-amber-200">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70">
          <div className="border-b border-white/10 px-5 py-4"><h2 className="text-lg font-black">Presupuestos por proyecto</h2></div>
          {presupuestos.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-lg font-black">Todavía no hay presupuestos integrados.</p>
              <p className="mt-2 text-sm text-slate-400">Se formarán a partir de conceptos cuantificados y Tarjetas APU aprobadas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1400px] w-full border-collapse text-left">
                <thead className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-4">Proyecto</th><th className="px-4 py-4">Cliente</th><th className="px-4 py-4">Versión</th>
                    <th className="px-4 py-4">Estado</th><th className="px-4 py-4">Conceptos</th><th className="px-4 py-4">Costo directo</th>
                    <th className="px-4 py-4">Indirectos</th><th className="px-4 py-4">Financiamiento</th><th className="px-4 py-4">Utilidad</th>
                    <th className="px-4 py-4">Cargos</th><th className="px-4 py-4">Impuestos</th><th className="px-4 py-4">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {presupuestos.map((p) => (
                    <tr key={p.id} className="border-t border-white/5">
                      <td className="px-4 py-4"><div className="font-mono text-xs text-amber-300">{p.proyecto.codigo}</div><div className="font-bold">{p.proyecto.nombre}</div></td>
                      <td className="px-4 py-4">{p.proyecto.clienteNombre}</td><td className="px-4 py-4">v{p.version}</td>
                      <td className="px-4 py-4">{p.estado}</td><td className="px-4 py-4">{p._count.conceptos}</td>
                      <td className="px-4 py-4">{money(Number(p.costoDirecto))}</td><td className="px-4 py-4">{money(Number(p.indirectos))}</td>
                      <td className="px-4 py-4">{money(Number(p.financiamiento))}</td><td className="px-4 py-4">{money(Number(p.utilidad))}</td>
                      <td className="px-4 py-4">{money(Number(p.cargosAdicionales))}</td><td className="px-4 py-4">{money(Number(p.impuestos))}</td>
                      <td className="px-4 py-4 font-black text-emerald-300">{money(Number(p.totalPresupuesto))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-6">
          <h2 className="text-xl font-black text-amber-200">Estructura del presupuesto</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4 lg:grid-cols-8">
            {["Cantidad","Precio Unitario","Importe","Costo Directo","Indirectos","Financiamiento","Utilidad","Total"].map((label, index) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
                <div className="text-xs font-black text-amber-300">0{index + 1}</div><div className="mt-2 font-black">{label}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}