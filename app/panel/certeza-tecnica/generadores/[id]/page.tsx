import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCertezaCostAccess } from "@/lib/certeza-tecnica/access";
import { prisma } from "@/lib/prisma";
import {
  agregarComponenteAPU,
  aprobarTarjetaAPU,
  crearConcepto,
  crearGenerador,
  crearTarjetaAPU,
  recalcularProyectoDesdeFicha,
} from "./actions";

export default async function ProyectoCostosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireCertezaCostAccess(`/panel/certeza-tecnica/generadores/${id}`);

  const [proyecto, insumos] = await Promise.all([
    prisma.proyectoGeneradores.findUnique({
      where: { id },
      include: {
        conceptos: {
          include: {
            generadores: { orderBy: { creadoEn: "desc" } },
            tarjetasAPU: {
              include: { componentes: { include: { insumo: true } } },
              orderBy: { version: "desc" },
            },
          },
          orderBy: [{ partida: "asc" }, { clave: "asc" }],
        },
        presupuestos: { orderBy: { version: "desc" }, take: 3 },
        explosionesInsumos: { orderBy: { version: "desc" }, take: 3 },
      },
    }),
    prisma.insumoAPU.findMany({ where: { activo: true }, orderBy: [{ tipo: "asc" }, { descripcion: "asc" }] }),
  ]);

  if (!proyecto) notFound();

  const money = (n: number) => "$" + n.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});
  const tarjetas = proyecto.conceptos.flatMap((c) => c.tarjetasAPU.map((t) => ({ ...t, concepto: c })));

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">Certeza Técnica · Flujo Operativo de Costos</p>
            <h1 className="mt-2 text-4xl font-black">{proyecto.codigo} · {proyecto.nombre}</h1>
            <p className="mt-2 text-sm text-slate-400">{proyecto.clienteNombre} · {proyecto.ubicacion ?? "Sin ubicación"}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/certeza-tecnica/app/costos/generadores" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-cyan-200">← Proyectos</Link>
            <Link href="/certeza-tecnica/app/costos/presupuestos" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-cyan-200">Presupuestos</Link>
            <form action={async () => { "use server"; await recalcularProyectoDesdeFicha(proyecto.id); }}>
              <button className="rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950">Recalcular costos</button>
            </form>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ["Conceptos", proyecto.conceptos.length],
            ["Generadores", proyecto.conceptos.reduce((a,c)=>a+c.generadores.length,0)],
            ["Tarjetas APU", tarjetas.length],
            ["APU aprobadas", tarjetas.filter((t)=>t.estado==="APROBADA").length],
          ].map(([label,value]) => (
            <div key={String(label)} className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-black text-amber-200">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-black">1. Crear concepto</h2>
            <form action={crearConcepto.bind(null, proyecto.id)} className="mt-5 grid gap-3 md:grid-cols-2">
              <input name="clave" placeholder="Clave" className="rounded-xl bg-slate-950 px-4 py-3" />
              <input name="partida" placeholder="Partida" className="rounded-xl bg-slate-950 px-4 py-3" />
              <input name="descripcion" placeholder="Descripción del concepto" required className="md:col-span-2 rounded-xl bg-slate-950 px-4 py-3" />
              <input name="unidad" placeholder="Unidad (m2, m3, pza...)" required className="rounded-xl bg-slate-950 px-4 py-3" />
              <input name="observaciones" placeholder="Observaciones" className="rounded-xl bg-slate-950 px-4 py-3" />
              <button className="md:col-span-2 rounded-xl bg-amber-300 px-4 py-3 font-black text-slate-950">Guardar concepto</button>
            </form>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-black">2. Capturar generador</h2>
            <form action={crearGenerador.bind(null, proyecto.id)} className="mt-5 grid gap-3 md:grid-cols-2">
              <select name="conceptoId" required className="md:col-span-2 rounded-xl bg-slate-950 px-4 py-3">
                <option value="">Seleccionar concepto</option>
                {proyecto.conceptos.map((c)=><option key={c.id} value={c.id}>{c.clave ?? "SIN CLAVE"} · {c.descripcion}</option>)}
              </select>
              <input name="total" type="number" step="0.000001" min="0" placeholder="Cantidad total" required className="rounded-xl bg-slate-950 px-4 py-3" />
              <input name="observaciones" placeholder="Observaciones" className="rounded-xl bg-slate-950 px-4 py-3" />
              <button className="md:col-span-2 rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950">Guardar generador aprobado</button>
            </form>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-black">3. Crear Tarjeta APU</h2>
            <form action={crearTarjetaAPU.bind(null, proyecto.id)} className="mt-5 grid gap-3 md:grid-cols-2">
              <select name="conceptoId" required className="md:col-span-2 rounded-xl bg-slate-950 px-4 py-3">
                <option value="">Seleccionar concepto</option>
                {proyecto.conceptos.map((c)=><option key={c.id} value={c.id}>{c.clave ?? "SIN CLAVE"} · {c.descripcion}</option>)}
              </select>
              <input name="rendimiento" type="number" step="0.000001" placeholder="Rendimiento" className="rounded-xl bg-slate-950 px-4 py-3" />
              <input name="costoDirecto" type="number" step="0.000001" placeholder="Costo directo inicial" className="rounded-xl bg-slate-950 px-4 py-3" />
              <input name="porcentajeIndirectos" type="number" step="0.0001" placeholder="% indirectos" className="rounded-xl bg-slate-950 px-4 py-3" />
              <input name="porcentajeFinanciamiento" type="number" step="0.0001" placeholder="% financiamiento" className="rounded-xl bg-slate-950 px-4 py-3" />
              <input name="porcentajeUtilidad" type="number" step="0.0001" placeholder="% utilidad" className="rounded-xl bg-slate-950 px-4 py-3" />
              <input name="porcentajeCargosAdicionales" type="number" step="0.0001" placeholder="% cargos adicionales" className="rounded-xl bg-slate-950 px-4 py-3" />
              <button className="md:col-span-2 rounded-xl bg-amber-300 px-4 py-3 font-black text-slate-950">Crear APU en borrador</button>
            </form>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-black">4. Agregar insumo a APU</h2>
            <form action={agregarComponenteAPU.bind(null, proyecto.id)} className="mt-5 grid gap-3 md:grid-cols-2">
              <select name="tarjetaId" required className="md:col-span-2 rounded-xl bg-slate-950 px-4 py-3">
                <option value="">Seleccionar APU</option>
                {tarjetas.filter((t)=>t.estado==="BORRADOR").map((t)=><option key={t.id} value={t.id}>{t.concepto.clave ?? "SIN CLAVE"} · v{t.version}</option>)}
              </select>
              <select name="insumoId" required className="md:col-span-2 rounded-xl bg-slate-950 px-4 py-3">
                <option value="">Seleccionar insumo</option>
                {insumos.map((i)=><option key={i.id} value={i.id}>{i.tipo} · {i.clave} · {i.descripcion} · {money(Number(i.precioBase))}/{i.unidad}</option>)}
              </select>
              <input name="cantidad" type="number" step="0.000001" placeholder="Cantidad por unidad de concepto" required className="rounded-xl bg-slate-950 px-4 py-3" />
              <input name="desperdicioPct" type="number" step="0.0001" placeholder="% desperdicio" className="rounded-xl bg-slate-950 px-4 py-3" />
              <input name="precioAplicado" type="number" step="0.000001" placeholder="Precio aplicado (opcional)" className="rounded-xl bg-slate-950 px-4 py-3" />
              <input name="observaciones" placeholder="Observaciones" className="rounded-xl bg-slate-950 px-4 py-3" />
              <button className="md:col-span-2 rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950">Agregar insumo</button>
            </form>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-xl font-black">5. Revisar y aprobar APU</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {tarjetas.length===0 ? <p className="text-slate-400">Todavía no hay tarjetas.</p> : tarjetas.map((t)=>(
              <div key={t.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-black text-amber-300">{t.concepto.clave ?? "SIN CLAVE"} · v{t.version}</div>
                    <div className="mt-1 font-black">{t.concepto.descripcion}</div>
                    <div className="mt-2 text-sm text-slate-400">{t.componentes.length} insumos · CD {money(Number(t.costoDirecto))} · PU {money(Number(t.precioUnitario))}</div>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black">{t.estado}</span>
                </div>
                <div className="mt-4 space-y-2">
                  {t.componentes.map((x)=><div key={x.id} className="flex justify-between gap-3 text-sm"><span>{x.insumo.clave} · {x.insumo.descripcion}</span><span className="font-black">{money(Number(x.importe))}</span></div>)}
                </div>
                {t.estado==="BORRADOR" && (
                  <form action={aprobarTarjetaAPU.bind(null, proyecto.id, t.id)} className="mt-4">
                    <button className="w-full rounded-xl bg-emerald-300 px-4 py-3 font-black text-slate-950">Aprobar APU</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-black">Presupuestos generados</h2>
            <div className="mt-4 space-y-3">
              {proyecto.presupuestos.length===0 ? <p className="text-slate-400">Sin presupuesto generado.</p> : proyecto.presupuestos.map((p)=>(
                <div key={p.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex justify-between"><span className="font-black">v{p.version} · {p.estado}</span><span className="font-black text-emerald-300">{money(Number(p.totalPresupuesto))}</span></div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-black">Explosiones generadas</h2>
            <div className="mt-4 space-y-3">
              {proyecto.explosionesInsumos.length===0 ? <p className="text-slate-400">Sin explosión generada.</p> : proyecto.explosionesInsumos.map((e)=>(
                <div key={e.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex justify-between"><span className="font-black">v{e.version} · {e.estado}</span><span className="font-black text-cyan-300">{money(Number(e.totalGeneral))}</span></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}