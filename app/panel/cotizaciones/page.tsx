import Link from "next/link";
import { EstadoCotizacion, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  aceptarEnRepresentacionDelCliente,
  autorizarCotizacionAceptada,
  marcarListaParaCliente,
} from "./actions-flujo-aprobado";

function dinero(valor: unknown) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(Number(valor ?? 0));
}

function fecha(valor: Date | null) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }).format(valor);
}

export default async function CotizacionesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; q?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuarioActual = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true },
  });
  if (!usuarioActual?.activo) redirect("/acceso");
  if (![RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR, RolUsuario.VENDEDOR].includes(usuarioActual.rol)) redirect("/acceso");

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const puedeGestionar = usuarioActual.rol === RolUsuario.DIRECTOR || usuarioActual.rol === RolUsuario.ADMINISTRADOR;

  const cotizaciones = await prisma.cotizacion.findMany({
    where: q ? {
      OR: [
        { folio: { contains: q, mode: "insensitive" } },
        { cliente: { nombre: { contains: q, mode: "insensitive" } } },
        { inmueble: { alias: { contains: q, mode: "insensitive" } } },
      ],
    } : undefined,
    select: {
      id: true, folio: true, estado: true, estadoPago: true, total: true, montoPagado: true,
      creadoEn: true, vigenciaHasta: true, aceptadaEn: true, autorizadaEn: true,
      observacionesInternas: true, motivoRechazo: true,
      cliente: { select: { id: true, nombre: true, correo: true, usuarioId: true, usuario: { select: { email: true, activo: true } } } },
      inmueble: { select: { id: true, alias: true, direccion: true, ciudad: true } },
      autorizadaPor: { select: { nombre: true } },
      inspeccion: { select: { id: true, folio: true, numeroInspeccion: true } },
    },
    orderBy: { creadoEn: "desc" },
  });

  const pendientesCliente = cotizaciones.filter((c) => c.estado === EstadoCotizacion.ENVIADA).length;
  const pendientesAutorizacion = cotizaciones.filter((c) => c.estado === EstadoCotizacion.ACEPTADA).length;
  const autorizadas = cotizaciones.filter((c) => c.estado === EstadoCotizacion.AUTORIZADA).length;

  return <main className="min-h-screen bg-slate-950 px-6 py-8 text-white"><div className="mx-auto max-w-7xl">
    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div>
        <Link href="/panel" className="text-sm font-black text-cyan-300">← Volver al panel</Link>
        <p className="mt-7 text-sm font-black uppercase tracking-[0.3em] text-amber-300">Flujo comercial aprobado</p>
        <h1 className="mt-3 text-4xl font-black">Cotizaciones</h1>
        <p className="mt-3 max-w-3xl text-slate-400">La cotización formal se pone primero a aceptación del cliente. Solo después puede ser autorizada por Dirección o Administración y pasar a Caja.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {puedeGestionar && <Link href="/panel/clientes/accesos" className="rounded-full border border-white/15 px-5 py-3 text-sm font-black">Acceso de clientes</Link>}
        {puedeGestionar && <Link href="/panel/caja" className="rounded-full border border-white/15 px-5 py-3 text-sm font-black">Caja</Link>}
      </div>
    </div>

    {(params.ok || params.error) && <div className={`mt-7 rounded-2xl border p-5 ${params.error ? "border-rose-400/20 bg-rose-400/5" : "border-emerald-400/20 bg-emerald-400/5"}`}><p className={`font-bold ${params.error ? "text-rose-300" : "text-emerald-300"}`}>{params.error ?? params.ok}</p></div>}

    <section className="mt-8 grid gap-4 sm:grid-cols-3">
      <Indicador titulo="Pendientes del cliente" valor={pendientesCliente} detalle="Cotizaciones listas para aceptar" />
      <Indicador titulo="Pendientes de autorización" valor={pendientesAutorizacion} detalle="Ya aceptadas por cliente" />
      <Indicador titulo="En Caja" valor={autorizadas} detalle="Aceptadas y autorizadas" />
    </section>

    <form className="mt-8 flex max-w-2xl gap-2"><input name="q" defaultValue={q} placeholder="Buscar folio, cliente o inmueble" className="min-w-0 flex-1 rounded-full border border-white/10 bg-slate-900 px-5 py-3"/><button className="rounded-full border border-white/15 px-5 py-3 font-black">Filtrar</button></form>

    {puedeGestionar && <div className="mt-8 rounded-3xl border border-cyan-300/20 bg-cyan-300/5 p-6"><p className="font-black text-cyan-300">Cotización definitiva</p><p className="mt-2 text-sm leading-6 text-slate-300">La pre-cotización pública permanece intacta. La versión definitiva se ajusta fuera del sistema y debe cargarse como PDF sin la marca PRE COTIZACIÓN. Este panel controla la aceptación, autorización y paso a Caja.</p></div>}

    <section className="mt-8 space-y-5">
      {cotizaciones.map((c) => {
        const total = Number(c.total); const pagado = Number(c.montoPagado); const pendiente = Math.max(0, total - pagado);
        return <article key={c.id} className="rounded-3xl border border-white/10 bg-slate-900 p-7">
          <div className="flex flex-col justify-between gap-5 lg:flex-row"><div><div className="flex flex-wrap items-center gap-3"><p className="font-mono text-xs font-black text-cyan-300">{c.folio}</p><Estado estado={c.estado}/></div><h2 className="mt-3 text-2xl font-black">{c.cliente.nombre}</h2><p className="mt-2 text-sm text-slate-400">{c.inmueble ? `${c.inmueble.alias} · ${c.inmueble.direccion}, ${c.inmueble.ciudad}` : "Sin inmueble asociado"}</p><div className="mt-4 grid gap-3 text-sm text-slate-400 sm:grid-cols-2 lg:grid-cols-4"><p>Creada: <strong className="text-slate-200">{fecha(c.creadoEn)}</strong></p><p>Aceptada: <strong className="text-slate-200">{fecha(c.aceptadaEn)}</strong></p><p>Autorizada: <strong className="text-slate-200">{fecha(c.autorizadaEn)}</strong></p><p>Vigencia: <strong className="text-slate-200">{fecha(c.vigenciaHasta)}</strong></p></div></div><div className="lg:text-right"><p className="text-xs font-black uppercase tracking-widest text-slate-500">Importe</p><p className="mt-1 text-3xl font-black text-cyan-300">{dinero(total)}</p><p className="mt-2 text-sm text-slate-400">Pagado {dinero(pagado)} · Saldo {dinero(pendiente)}</p></div></div>

          {c.observacionesInternas && <div className="mt-5 rounded-2xl border border-amber-300/10 bg-amber-300/5 p-4 text-sm text-slate-300">{c.observacionesInternas}</div>}

          {puedeGestionar && <div className="mt-6 border-t border-white/10 pt-5">
            {c.estado === EstadoCotizacion.BORRADOR && <div className="flex flex-wrap items-center gap-3">{!c.cliente.usuarioId ? <Link href="/panel/clientes/accesos" className="rounded-full bg-amber-300 px-5 py-3 text-sm font-black text-slate-950">Asignar acceso al cliente</Link> : <form action={marcarListaParaCliente}><input type="hidden" name="id" value={c.id}/><button className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">Poner a aceptación del cliente</button></form>}</div>}

            {c.estado === EstadoCotizacion.ENVIADA && <div className="space-y-4"><p className="font-black text-cyan-300">Pendiente de aceptación del cliente.</p><form action={aceptarEnRepresentacionDelCliente} className="flex flex-col gap-3 md:flex-row"><input type="hidden" name="id" value={c.id}/><input name="motivo" required placeholder="Motivo de aceptación excepcional en representación del cliente" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3"/><button className="rounded-xl border border-amber-300/30 px-5 py-3 font-black text-amber-300">Aceptar por excepción</button></form></div>}

            {c.estado === EstadoCotizacion.ACEPTADA && <div className="flex flex-wrap items-center gap-3"><p className="font-black text-emerald-300">Aceptada por el cliente. Pendiente de autorización interna.</p><form action={autorizarCotizacionAceptada}><input type="hidden" name="id" value={c.id}/><button className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950">Autorizar y enviar a Caja</button></form></div>}

            {c.estado === EstadoCotizacion.AUTORIZADA && <div className="flex flex-wrap items-center gap-3"><p className="font-black text-violet-300">Cotización autorizada y disponible en Caja.</p><Link href="/panel/caja" className="rounded-full border border-violet-300/30 px-5 py-3 text-sm font-black text-violet-300">Abrir Caja</Link>{c.inspeccion && <Link href={`/panel/inspecciones/${c.inspeccion.id}`} className="rounded-full border border-white/15 px-5 py-3 text-sm font-black">Ver V{c.inspeccion.numeroInspeccion}</Link>}</div>}
          </div>}

          {usuarioActual.rol === RolUsuario.VENDEDOR && <div className="mt-6 rounded-2xl border border-white/10 p-4 text-sm text-slate-400">Consulta únicamente. El Vendedor no puede aceptar, autorizar ni registrar pagos.</div>}
        </article>;
      })}
      {cotizaciones.length === 0 && <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-slate-400">No hay cotizaciones con ese filtro.</div>}
    </section>
  </div></main>;
}

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: number; detalle: string }) { return <article className="rounded-3xl border border-white/10 bg-slate-900 p-6"><p className="text-sm font-bold text-slate-400">{titulo}</p><p className="mt-4 text-3xl font-black text-cyan-300">{String(valor).padStart(2, "0")}</p><p className="mt-2 text-xs text-slate-600">{detalle}</p></article>; }
function Estado({ estado }: { estado: EstadoCotizacion }) { const cls = estado === EstadoCotizacion.AUTORIZADA ? "text-violet-300 bg-violet-400/10" : estado === EstadoCotizacion.ACEPTADA ? "text-emerald-300 bg-emerald-400/10" : estado === EstadoCotizacion.ENVIADA ? "text-cyan-300 bg-cyan-400/10" : estado === EstadoCotizacion.RECHAZADA || estado === EstadoCotizacion.CANCELADA ? "text-rose-300 bg-rose-400/10" : "text-slate-300 bg-slate-400/10"; return <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>{estado.replaceAll("_", " ")}</span>; }
