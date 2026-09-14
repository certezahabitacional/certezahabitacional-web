import Link from "next/link";
import { notFound } from "next/navigation";
import { EstadoCotizacion, Prisma } from "@prisma/client";

import { obtenerClienteActual } from "@/lib/cliente-actual";
import { prisma } from "@/lib/prisma";
import { aceptarCotizacionCliente, rechazarCotizacionCliente } from "../actions";

type Props = { params: Promise<{ id: string }> };
type Obj = Record<string, unknown>;
function dinero(valor: unknown) { return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(Number(valor ?? 0)); }
function fecha(valor: Date | null | undefined) { if (!valor) return "—"; return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }).format(valor); }
function obj(v: Prisma.JsonValue | undefined): Obj | null { return v && typeof v === "object" && !Array.isArray(v) ? v as Obj : null; }
function txt(v: unknown, fallback = ""){ return typeof v === "string" && v.trim() ? v.trim() : fallback; }
function num(v: unknown, fallback: unknown){ const n=Number(v); return Number.isFinite(n) ? n : Number(fallback ?? 0); }

export default async function CotizacionClientePage({ params }: Props) {
  const clienteActual = await obtenerClienteActual(); const { id } = await params;
  const cotizacion = await prisma.cotizacion.findFirst({ where: { id, clienteId: clienteActual.id }, include: { cliente:true, inmueble: true, paquete: true, versiones: { orderBy: { version: "desc" }, take: 1, select: { version: true, datos:true, total:true } } } });
  if (!cotizacion) notFound();
  const estadosConsultables: EstadoCotizacion[] = [EstadoCotizacion.ENVIADA, EstadoCotizacion.ACEPTADA, EstadoCotizacion.RECHAZADA];
  const puedeConsultar = estadosConsultables.includes(cotizacion.estado); if (!puedeConsultar) notFound();
  const version = cotizacion.versiones[0];
  if (!version || version.version !== cotizacion.versionActual) notFound();

  const datos=obj(version.datos); const cliente=obj(datos?.cliente as Prisma.JsonValue | undefined); const inmueble=obj(datos?.inmueble as Prisma.JsonValue | undefined);
  const nombreCliente=txt(cliente?.nombre,cotizacion.cliente.nombre);
  const alias=txt(inmueble?.alias,cotizacion.inmueble?.alias ?? "Sin inmueble asignado");
  const direccion=txt(inmueble?.direccion,cotizacion.inmueble?.direccion ?? "");
  const superficie=num(inmueble?.m2Construccion,cotizacion.superficieM2);
  const total=num(datos?.total,version.total ?? cotizacion.total);
  const precioBase=total;
  const metrosAdicionales=0;
  const cargoMetrosAdicionales=0;
  const cargosExtra=0;
  const descuento=0;
  const subtotal=total;
  const versionVisible=version.version;

  return <main className="px-6 py-10"><div className="mx-auto max-w-6xl">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><Link href="/portal/cotizaciones" className="text-sm font-bold text-cyan-300">← Volver a cotizaciones</Link><Link href={`/portal/cotizaciones/${cotizacion.id}/imprimir`} className="rounded-full border border-cyan-300/30 px-5 py-3 text-sm font-black text-cyan-300">Ver / imprimir cotización oficial V{versionVisible}</Link></div>
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900"><header className="border-b border-white/10 p-8"><div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Cotización · V{versionVisible}</p><h1 className="mt-3 text-3xl font-black">{cotizacion.folio}</h1><div className="mt-4"><EstadoBadge estado={cotizacion.estado}/></div></div><div className="lg:text-right"><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Total cotizado</p><p className="mt-2 text-4xl font-black text-cyan-300">{dinero(total)}</p><p className="mt-2 text-sm text-slate-500">Vigencia hasta: {fecha(cotizacion.vigenciaHasta)}</p></div></div></header>
    <div className="p-8"><section><h2 className="text-xl font-black">Datos del servicio</h2><div className="mt-5 grid gap-4 md:grid-cols-2"><Dato titulo="Cliente" valor={nombreCliente}/><Dato titulo="Paquete" valor={cotizacion.paquete?.nombre ?? "Sin paquete"}/><Dato titulo="Inmueble" valor={`${alias}${direccion ? ` — ${direccion}` : ""}`}/><Dato titulo="Superficie" valor={`${superficie.toLocaleString("es-MX")} m²`}/></div></section>
    <section className="mt-8"><h2 className="text-xl font-black">Desglose económico</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Importe titulo="Precio base" valor={dinero(precioBase)}/><Importe titulo="M² adicionales" valor={`${metrosAdicionales.toLocaleString("es-MX")} m²`}/><Importe titulo="Cargo m² adicionales" valor={dinero(cargoMetrosAdicionales)}/><Importe titulo="Cargos extra" valor={dinero(cargosExtra)}/><Importe titulo="Descuento" valor={dinero(descuento)}/><Importe titulo="Subtotal" valor={dinero(subtotal)}/></div><div className="mt-5 rounded-3xl bg-slate-950 p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="font-black uppercase tracking-[0.15em] text-slate-500">Total V{versionVisible}</p><p className="text-3xl font-black text-cyan-300">{dinero(total)}</p></div></div></section>
    {cotizacion.notas && <section className="mt-8 rounded-3xl border border-white/10 p-6"><h2 className="font-black">Notas de la cotización</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{cotizacion.notas}</p></section>}
    {cotizacion.estado===EstadoCotizacion.ENVIADA && <section className="mt-8 rounded-3xl border border-cyan-400/30 bg-cyan-400/5 p-6"><p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Acción requerida · V{versionVisible}</p><h2 className="mt-2 text-2xl font-black">Revisa y responde esta versión</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Los datos mostrados provienen de la versión documental V{versionVisible}. Verifica cliente, inmueble, superficie, precio y vigencia antes de responder.</p>
      <div className="mt-7 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5"><p className="font-black text-emerald-300">Aceptar V{versionVisible}</p><form action={aceptarCotizacionCliente} className="mt-5"><input type="hidden" name="id" value={cotizacion.id}/><input type="hidden" name="version" value={versionVisible}/><label className="flex max-w-3xl items-start gap-3 text-sm text-slate-300"><input type="checkbox" name="aceptaTerminos" value="si" required className="mt-1 h-4 w-4"/><span>Confirmo que revisé la versión V{versionVisible}, sus datos y su importe, y deseo continuar con el servicio de Certeza Habitacional.</span></label><button type="submit" className="mt-5 rounded-full bg-emerald-300 px-6 py-3 text-sm font-black text-slate-950">Aceptar V{versionVisible}</button></form></div>
      <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-5"><p className="font-black text-rose-300">Rechazar V{versionVisible}</p><form action={rechazarCotizacionCliente} className="mt-5"><input type="hidden" name="id" value={cotizacion.id}/><input type="hidden" name="version" value={versionVisible}/><textarea name="motivo" rows={4} placeholder="Motivo del rechazo (opcional)" className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white"/><button type="submit" className="mt-4 rounded-full bg-rose-300 px-6 py-3 text-sm font-black text-slate-950">Rechazar V{versionVisible}</button></form></div>
    </section>}
    {cotizacion.estado===EstadoCotizacion.ACEPTADA && <section className="mt-8 rounded-3xl border border-emerald-400/30 bg-emerald-400/5 p-6"><p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">V{versionVisible} aceptada</p><h2 className="mt-2 text-2xl font-black">Gracias por tu aceptación</h2><p className="mt-3 text-sm leading-6 text-slate-400">Tu aceptación quedó vinculada a esta versión. Certeza Habitacional continuará con la autorización interna antes de seguir con el proceso operativo.</p></section>}
    {cotizacion.estado===EstadoCotizacion.RECHAZADA && <section className="mt-8 rounded-3xl border border-rose-400/30 bg-rose-400/5 p-6"><p className="text-xs font-black uppercase tracking-[0.25em] text-rose-300">V{versionVisible} rechazada</p><h2 className="mt-2 text-2xl font-black">Esta propuesta fue rechazada</h2>{cotizacion.motivoRechazo&&<div className="mt-5 rounded-2xl bg-slate-950 p-5"><p className="text-xs font-black uppercase tracking-widest text-slate-500">Motivo</p><p className="mt-2 text-sm leading-6 text-slate-300">{cotizacion.motivoRechazo}</p></div>}</section>}
    </div></section></div></main>;
}
function Dato({titulo,valor}:{titulo:string;valor:string}){return <div className="rounded-2xl bg-slate-950 p-5"><p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">{titulo}</p><p className="mt-2 font-bold text-slate-100">{valor}</p></div>}
function Importe({titulo,valor}:{titulo:string;valor:string}){return <div className="rounded-2xl bg-slate-950 p-5"><p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">{titulo}</p><p className="mt-3 text-xl font-black">{valor}</p></div>}
function EstadoBadge({estado}:{estado:EstadoCotizacion}){let estilos="bg-slate-400/10 text-slate-300";if(estado===EstadoCotizacion.ENVIADA)estilos="bg-cyan-400/10 text-cyan-300";if(estado===EstadoCotizacion.ACEPTADA)estilos="bg-emerald-400/10 text-emerald-300";if(estado===EstadoCotizacion.RECHAZADA)estilos="bg-rose-400/10 text-rose-300";return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${estilos}`}>{estado.replaceAll("_"," ")}</span>}
