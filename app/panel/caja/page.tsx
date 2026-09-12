import Link from "next/link";
import { EstadoCotizacion, Prisma, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autorizarExcepcionApertura, autorizarExcepcionInicio, registrarPagoLibre } from "./actions";

function dinero(valor: number) {
  return valor.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function vendedorDesdeJson(datos: Prisma.JsonValue | null) {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return null;
  const vendedor = (datos as Prisma.JsonObject).vendedor;
  if (!vendedor || typeof vendedor !== "object" || Array.isArray(vendedor)) return null;
  const objeto = vendedor as Prisma.JsonObject;
  return typeof objeto.nombre === "string" ? objeto.nombre : null;
}

export default async function CajaPage({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { rol: true, activo: true } });
  if (!usuario?.activo || (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR)) redirect("/acceso");

  const params = await searchParams;
  const busqueda = (params.q ?? "").trim();
  const cotizaciones = await prisma.cotizacion.findMany({
    where: {
      estado: EstadoCotizacion.AUTORIZADA,
      ...(busqueda ? { OR: [
        { folio: { contains: busqueda, mode: "insensitive" } },
        { cliente: { nombre: { contains: busqueda, mode: "insensitive" } } },
        { inmueble: { alias: { contains: busqueda, mode: "insensitive" } } },
      ] } : {}),
    },
    select: {
      id: true, folio: true, total: true, montoPagado: true, estadoPago: true,
      excepcionApertura: true, excepcionInicio: true, motivoExcepcionApertura: true, motivoExcepcionInicio: true,
      cliente: { select: { nombre: true } }, inmueble: { select: { alias: true } },
      inspeccion: { select: { folio: true, numeroInspeccion: true, inspector: { select: { usuario: { select: { nombre: true } } } } } },
      versiones: { orderBy: { version: "desc" }, take: 1, select: { datos: true } },
      pagos: { select: { id: true, monto: true, fechaPago: true, metodoPago: true, referencia: true }, orderBy: { fechaPago: "desc" } },
    },
    orderBy: { autorizadaEn: "desc" },
  });

  return <main className="min-h-screen bg-slate-950 px-6 py-8 text-white"><div className="mx-auto max-w-7xl">
    <Link href="/panel" className="text-sm font-bold text-cyan-300">← Panel</Link>
    <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><h1 className="text-3xl font-black">Caja</h1><p className="mt-2 text-slate-400">Cotizaciones aceptadas y autorizadas, pagos, saldos, responsables y liberaciones financieras.</p></div>
      <div className="flex flex-wrap gap-3">
        <Link href="/panel/caja/comisiones" className="rounded-full border border-amber-300/30 px-5 py-3 text-sm font-black text-amber-300">Estado de comisiones</Link>
        <form className="flex gap-2"><input name="q" defaultValue={busqueda} placeholder="Folio, cliente o inmueble" className="rounded-full border border-white/10 bg-slate-900 px-5 py-3"/><button className="rounded-full border border-white/15 px-5 py-3 font-bold">Filtrar</button></form>
      </div>
    </div>
    {(params.ok || params.error) && <p className={`mt-6 rounded-2xl p-4 font-bold ${params.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>{params.error ?? params.ok}</p>}

    <div className="mt-8 space-y-5">{cotizaciones.map((c) => {
      const total = Number(c.total); const pagado = Number(c.montoPagado); const pendiente = Math.max(0, total - pagado); const porcentaje = total > 0 ? pagado / total * 100 : 0;
      const vendedor = vendedorDesdeJson(c.versiones[0]?.datos ?? null) ?? "Por asignar";
      const inspector = c.inspeccion?.inspector?.usuario.nombre ?? "Por asignar";
      return <details key={c.id} className="rounded-3xl border border-white/10 bg-slate-900 p-5" open={Boolean(busqueda)}>
        <summary className="cursor-pointer list-none"><div className="grid gap-3 md:grid-cols-4 xl:grid-cols-10"><Dato t="Cotización" v={c.folio}/><Dato t="Cliente" v={c.cliente.nombre}/><Dato t="Inmueble" v={c.inmueble?.alias ?? "Por definir"}/><Dato t="Vendedor" v={vendedor}/><Dato t="Inspector" v={inspector}/><Dato t="Versión" v={c.inspeccion ? `V${c.inspeccion.numeroInspeccion}` : "Por abrir"}/><Dato t="Importe" v={dinero(total)}/><Dato t="Pagado" v={`${dinero(pagado)} · ${porcentaje.toFixed(0)}%`}/><Dato t="Pendiente" v={dinero(pendiente)}/><Dato t="Estado" v={c.estadoPago}/></div></summary>
        <div className="mt-5 grid gap-5 border-t border-white/10 pt-5 lg:grid-cols-2">
          <section><h2 className="font-black text-cyan-300">Registrar pago</h2><form action={registrarPagoLibre} className="mt-3 grid gap-3 sm:grid-cols-2"><input type="hidden" name="cotizacionId" value={c.id}/><input name="monto" type="number" min="0.01" step="0.01" max={pendiente} required placeholder="Importe" className="rounded-xl bg-slate-950 px-4 py-3"/><input name="metodoPago" placeholder="Método de pago" className="rounded-xl bg-slate-950 px-4 py-3"/><input name="referencia" placeholder="Referencia" className="rounded-xl bg-slate-950 px-4 py-3"/><input name="notas" placeholder="Notas" className="rounded-xl bg-slate-950 px-4 py-3"/><button disabled={pendiente <= 0.001} className="rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950 disabled:opacity-40">Registrar pago</button></form>
          <div className="mt-4 space-y-1 text-xs text-slate-400">{c.pagos.slice(0,5).map(p => <p key={p.id}>{p.fechaPago.toLocaleDateString("es-MX")} · {dinero(Number(p.monto))} · {p.metodoPago ?? "Sin método"} {p.referencia ? `· ${p.referencia}` : ""}</p>)}</div></section>
          <section><h2 className="font-black text-amber-300">Reglas de liberación</h2><p className="mt-2 text-sm text-slate-400">50% para abrir la inspección y 100% para iniciar campo. Solo Dirección puede autorizar excepciones.</p>
          {usuario.rol === RolUsuario.DIRECTOR && <div className="mt-4 space-y-4">
            {!c.excepcionApertura && porcentaje < 50 && <form action={autorizarExcepcionApertura} className="flex gap-2"><input type="hidden" name="cotizacionId" value={c.id}/><input name="motivo" required placeholder="Motivo excepción 50%" className="min-w-0 flex-1 rounded-xl bg-slate-950 px-4 py-3"/><button className="rounded-xl border border-amber-300/30 px-4 font-bold text-amber-300">Autorizar apertura</button></form>}
            {!c.excepcionInicio && porcentaje < 100 && <form action={autorizarExcepcionInicio} className="flex gap-2"><input type="hidden" name="cotizacionId" value={c.id}/><input name="motivo" required placeholder="Motivo excepción 100%" className="min-w-0 flex-1 rounded-xl bg-slate-950 px-4 py-3"/><button className="rounded-xl border border-rose-300/30 px-4 font-bold text-rose-300">Autorizar inicio</button></form>}
          </div>}
          <div className="mt-4 text-xs"><p className={c.excepcionApertura ? "text-amber-300" : "text-slate-500"}>Excepción apertura: {c.excepcionApertura ? `Sí · ${c.motivoExcepcionApertura ?? "sin motivo visible"}` : "No"}</p><p className={c.excepcionInicio ? "text-rose-300" : "text-slate-500"}>Excepción inicio: {c.excepcionInicio ? `Sí · ${c.motivoExcepcionInicio ?? "sin motivo visible"}` : "No"}</p></div></section>
        </div>
      </details>;
    })}{cotizaciones.length === 0 && <div className="rounded-3xl border border-white/10 bg-slate-900 p-10 text-center text-slate-400">No hay cotizaciones autorizadas con ese filtro.</div>}</div>
  </div></main>;
}

function Dato({ t, v }: { t: string; v: string }) { return <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t}</p><p className="mt-1 font-bold">{v}</p></div>; }
