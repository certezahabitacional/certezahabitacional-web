import Link from "next/link";
import { EstadoCotizacion, Prisma, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { asignarVendedorCotizacion, registrarPagoComision } from "./actions";

type VendedorGuardado = {
  id: string;
  nombre: string;
  email: string;
  porcentajeComision?: number;
};

type PagoAcumulado = {
  cotizacionId: string;
  beneficiarioId: string;
  tipo: string;
  pagado: Prisma.Decimal | null;
};

function dinero(valor: number) {
  return valor.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  });
}

function vendedorDesdeJson(datos: Prisma.JsonValue | null): VendedorGuardado | null {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return null;
  const vendedor = (datos as Prisma.JsonObject).vendedor;
  if (!vendedor || typeof vendedor !== "object" || Array.isArray(vendedor)) return null;
  const objeto = vendedor as Prisma.JsonObject;
  if (typeof objeto.id !== "string" || typeof objeto.nombre !== "string" || typeof objeto.email !== "string") return null;
  return {
    id: objeto.id,
    nombre: objeto.nombre,
    email: objeto.email,
    porcentajeComision: typeof objeto.porcentajeComision === "number" ? objeto.porcentajeComision : 10,
  };
}

function clavePago(cotizacionId: string, beneficiarioId: string, tipo: string) {
  return `${cotizacionId}:${beneficiarioId}:${tipo}`;
}

export default async function ComisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true },
  });
  if (
    !usuario?.activo ||
    (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR)
  ) redirect("/acceso");

  const params = await searchParams;
  const q = (params.q ?? "").trim();

  const [cotizaciones, vendedores, pagosAcumulados] = await Promise.all([
    prisma.cotizacion.findMany({
      where: {
        estado: EstadoCotizacion.AUTORIZADA,
        ...(q
          ? {
              OR: [
                { folio: { contains: q, mode: "insensitive" } },
                { cliente: { nombre: { contains: q, mode: "insensitive" } } },
                { inmueble: { alias: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        folio: true,
        total: true,
        montoPagado: true,
        cliente: { select: { nombre: true } },
        inmueble: { select: { alias: true } },
        inspeccion: {
          select: {
            numeroInspeccion: true,
            inspector: { select: { usuario: { select: { id: true, nombre: true, email: true } } } },
          },
        },
        versiones: {
          orderBy: { version: "desc" },
          take: 1,
          select: { datos: true },
        },
      },
      orderBy: { autorizadaEn: "desc" },
    }),
    prisma.usuario.findMany({
      where: { rol: RolUsuario.VENDEDOR, activo: true },
      select: { id: true, nombre: true, email: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.$queryRaw<PagoAcumulado[]>`
      SELECT
        "cotizacionId",
        "beneficiarioId",
        "tipo",
        COALESCE(SUM("monto"), 0) AS "pagado"
      FROM "PagoComision"
      GROUP BY "cotizacionId", "beneficiarioId", "tipo"
    `,
  ]);

  const pagosPorClave = new Map<string, number>();
  for (const pago of pagosAcumulados) {
    pagosPorClave.set(
      clavePago(pago.cotizacionId, pago.beneficiarioId, pago.tipo),
      Number(pago.pagado ?? 0),
    );
  }

  const renglones = cotizaciones.map((c) => {
    const total = Number(c.total);
    const cobrado = Number(c.montoPagado);
    const factorCobro = total > 0 ? Math.max(0, Math.min(1, cobrado / total)) : 0;
    const vendedor = vendedorDesdeJson(c.versiones[0]?.datos ?? null);
    const inspector = c.inspeccion?.inspector?.usuario ?? null;
    const comisionVendedor = total * 0.1;
    const comisionInspector = total * 0.3;
    const vendedorPagado = vendedor
      ? pagosPorClave.get(clavePago(c.id, vendedor.id, "VENDEDOR")) ?? 0
      : 0;
    const inspectorPagado = inspector
      ? pagosPorClave.get(clavePago(c.id, inspector.id, "INSPECTOR")) ?? 0
      : 0;

    return {
      ...c,
      total,
      cobrado,
      factorCobro,
      vendedor,
      inspector,
      comisionVendedor,
      comisionInspector,
      vendedorCubierto: comisionVendedor * factorCobro,
      inspectorCubierto: comisionInspector * factorCobro,
      vendedorPagado,
      inspectorPagado,
      vendedorSaldo: Math.max(0, comisionVendedor - vendedorPagado),
      inspectorSaldo: Math.max(0, comisionInspector - inspectorPagado),
    };
  });

  const totalVentas = renglones.reduce((a, r) => a + r.total, 0);
  const totalCobrado = renglones.reduce((a, r) => a + r.cobrado, 0);
  const totalComisionVendedores = renglones.reduce((a, r) => a + r.comisionVendedor, 0);
  const totalComisionInspectores = renglones.reduce((a, r) => a + r.comisionInspector, 0);
  const totalPagadoVendedores = renglones.reduce((a, r) => a + r.vendedorPagado, 0);
  const totalPagadoInspectores = renglones.reduce((a, r) => a + r.inspectorPagado, 0);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <Link href="/panel/caja" className="text-sm font-black text-cyan-300">← Caja</Link>
            <p className="mt-7 text-xs font-black uppercase tracking-[0.3em] text-amber-300">Control interno</p>
            <h1 className="mt-2 text-4xl font-black">Estado de comisiones</h1>
            <p className="mt-3 max-w-4xl text-slate-400">
              Vendedor: 10% del importe de la cotización. Inspector: 30%. El sistema distingue comisión generada, respaldo por cobranza, pagos reales al colaborador y saldo pendiente.
            </p>
          </div>
          <form className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="Folio, cliente o inmueble" className="rounded-full border border-white/10 bg-slate-900 px-5 py-3" />
            <button className="rounded-full border border-white/15 px-5 py-3 font-black">Filtrar</button>
          </form>
        </div>

        {(params.ok || params.error) && (
          <p className={`mt-6 rounded-2xl p-4 font-bold ${params.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>
            {params.error ?? params.ok}
          </p>
        )}

        <section className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Resumen titulo="Cotizaciones" valor={dinero(totalVentas)} />
          <Resumen titulo="Cobrado a clientes" valor={dinero(totalCobrado)} />
          <Resumen titulo="Vendedores generado" valor={dinero(totalComisionVendedores)} />
          <Resumen titulo="Vendedores pagado" valor={dinero(totalPagadoVendedores)} />
          <Resumen titulo="Inspectores generado" valor={dinero(totalComisionInspectores)} />
          <Resumen titulo="Inspectores pagado" valor={dinero(totalPagadoInspectores)} />
        </section>

        <div className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-slate-900">
          <table className="min-w-[1320px] w-full text-sm">
            <thead className="bg-slate-950/60 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-4">Cotización</th>
                <th className="px-5 py-4">Cliente / inmueble</th>
                <th className="px-5 py-4">Cobranza</th>
                <th className="px-5 py-4">Vendedor 10%</th>
                <th className="px-5 py-4">Inspector 30%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {renglones.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-5 py-5">
                    <p className="font-mono font-black text-cyan-300">{r.folio}</p>
                    <p className="mt-1 text-slate-500">{r.inspeccion ? `V${r.inspeccion.numeroInspeccion}` : "Sin inspección abierta"}</p>
                    <p className="mt-2 font-black">{dinero(r.total)}</p>
                  </td>
                  <td className="px-5 py-5">
                    <p className="font-bold">{r.cliente.nombre}</p>
                    <p className="mt-1 text-slate-500">{r.inmueble?.alias ?? "Sin inmueble"}</p>
                  </td>
                  <td className="px-5 py-5">
                    <p className="font-bold text-emerald-300">{dinero(r.cobrado)}</p>
                    <p className="mt-1 text-slate-500">{(r.factorCobro * 100).toFixed(0)}% cobrado</p>
                  </td>
                  <td className="px-5 py-5">
                    {r.vendedor ? (
                      <CuentaComision
                        cotizacionId={r.id}
                        tipo="VENDEDOR"
                        beneficiario={r.vendedor}
                        generada={r.comisionVendedor}
                        cubierta={r.vendedorCubierto}
                        pagada={r.vendedorPagado}
                        saldo={r.vendedorSaldo}
                      />
                    ) : (
                      <form action={asignarVendedorCotizacion} className="space-y-2">
                        <input type="hidden" name="cotizacionId" value={r.id} />
                        <select name="vendedorId" required className="w-full rounded-xl bg-slate-950 px-3 py-2">
                          <option value="">Asignar vendedor</option>
                          {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre} · {v.email}</option>)}
                        </select>
                        <button className="rounded-xl border border-cyan-300/30 px-3 py-2 text-xs font-black text-cyan-300">Guardar vendedor</button>
                      </form>
                    )}
                  </td>
                  <td className="px-5 py-5">
                    {r.inspector ? (
                      <CuentaComision
                        cotizacionId={r.id}
                        tipo="INSPECTOR"
                        beneficiario={r.inspector}
                        generada={r.comisionInspector}
                        cubierta={r.inspectorCubierto}
                        pagada={r.inspectorPagado}
                        saldo={r.inspectorSaldo}
                      />
                    ) : (
                      <p className="text-slate-500">Pendiente de asignar inspector a la inspección.</p>
                    )}
                  </td>
                </tr>
              ))}
              {renglones.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">No hay cotizaciones autorizadas con ese filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function CuentaComision({
  cotizacionId,
  tipo,
  beneficiario,
  generada,
  cubierta,
  pagada,
  saldo,
}: {
  cotizacionId: string;
  tipo: "VENDEDOR" | "INSPECTOR";
  beneficiario: { id: string; nombre: string; email: string };
  generada: number;
  cubierta: number;
  pagada: number;
  saldo: number;
}) {
  return (
    <div className="min-w-64">
      <p className="font-bold">{beneficiario.nombre}</p>
      <p className="text-xs text-slate-500">{beneficiario.email}</p>
      <div className="mt-3 space-y-1 text-xs">
        <p>Generada: <strong className="text-white">{dinero(generada)}</strong></p>
        <p className="text-emerald-300">Respaldada por cobranza: {dinero(cubierta)}</p>
        <p className="text-cyan-300">Pagada al colaborador: {dinero(pagada)}</p>
        <p className={saldo > 0.001 ? "text-amber-300" : "text-emerald-300"}>Saldo por pagar: {dinero(saldo)}</p>
      </div>

      {saldo > 0.001 && (
        <details className="mt-3 rounded-xl border border-white/10 bg-slate-950/70">
          <summary className="cursor-pointer px-3 py-2 text-xs font-black text-cyan-300">Registrar pago</summary>
          <form action={registrarPagoComision} className="space-y-2 border-t border-white/10 p-3">
            <input type="hidden" name="cotizacionId" value={cotizacionId} />
            <input type="hidden" name="beneficiarioId" value={beneficiario.id} />
            <input type="hidden" name="tipo" value={tipo} />
            <input name="monto" type="number" min="0.01" max={saldo} step="0.01" required placeholder={`Máx. ${dinero(saldo)}`} className="w-full rounded-lg bg-slate-900 px-3 py-2" />
            <input name="metodoPago" placeholder="Método de pago" className="w-full rounded-lg bg-slate-900 px-3 py-2" />
            <input name="referencia" placeholder="Referencia" className="w-full rounded-lg bg-slate-900 px-3 py-2" />
            <input name="notas" placeholder="Notas" className="w-full rounded-lg bg-slate-900 px-3 py-2" />
            <button className="w-full rounded-lg bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950">Registrar pago de comisión</button>
          </form>
        </details>
      )}
    </div>
  );
}

function Resumen({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900 p-5">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className="mt-3 text-xl font-black text-cyan-300">{valor}</p>
    </article>
  );
}
