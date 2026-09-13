import { EstadoCotizacion, Prisma, RolUsuario, TipoCliente } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardarPreCotizacion } from "./actions";

function fechaInput(fecha: Date | null) { if (!fecha) return ""; return fecha.toISOString().slice(0, 10); }
function objeto(v: Prisma.JsonValue | undefined): Record<string, any> | null { return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : null; }
function cadena(v: unknown, respaldo = "") { return typeof v === "string" ? v : respaldo; }
function numero(v: unknown, respaldo: number) { const n = Number(v); return Number.isFinite(n) ? n : respaldo; }

export default async function EditarPreCotizacionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login");
  const usuario = await prisma.usuario.findUnique({ where: { id: session.user.id }, select: { rol: true, activo: true } });
  if (!usuario?.activo || (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR)) redirect("/acceso");

  const { id } = await params; const mensajes = await searchParams;
  const c = await prisma.cotizacion.findUnique({ where: { id }, select: {
    id:true, folio:true, estado:true, versionActual:true, total:true, montoPagado:true, vigenciaHasta:true,
    cliente:{select:{folio:true,nombre:true,telefono:true,correo:true,tipo:true,empresa:true,direccion:true,colonia:true,ciudad:true,estado:true,codigoPostal:true}},
    inmueble:{select:{alias:true,direccion:true,colonia:true,ciudad:true,estado:true,codigoPostal:true,superficieTerrenoM2:true,superficieConstruccionM2:true}},
    versiones:{orderBy:{version:"desc"},take:1,select:{version:true,datos:true,total:true}},
  }});
  if (!c) notFound();
  if (![EstadoCotizacion.BORRADOR, EstadoCotizacion.ENVIADA, EstadoCotizacion.ACEPTADA].includes(c.estado)) redirect("/panel/cotizaciones");
  if (!c.inmueble) notFound();

  const version = c.versiones[0]; const datos = objeto(version?.datos); const propuesta = datos?.estadoCambios === "PENDIENTES_AUTORIZACION";
  const cliente = propuesta ? objeto(datos?.cliente) : null; const inmueble = propuesta ? objeto(datos?.inmueble) : null;
  const valores = {
    nombre: cadena(cliente?.nombre,c.cliente.nombre), telefono: cadena(cliente?.telefono,c.cliente.telefono??""), correo: cadena(cliente?.correo,c.cliente.correo??""),
    tipo: Object.values(TipoCliente).includes(cliente?.tipo as TipoCliente) ? cliente?.tipo as TipoCliente : c.cliente.tipo,
    empresa: cadena(cliente?.empresa,c.cliente.empresa??""), direccionCliente: cadena(cliente?.direccion,c.cliente.direccion??""), coloniaCliente: cadena(cliente?.colonia,c.cliente.colonia??""), ciudadCliente: cadena(cliente?.ciudad,c.cliente.ciudad??""), estadoCliente: cadena(cliente?.estado,c.cliente.estado??""), codigoPostalCliente: cadena(cliente?.codigoPostal,c.cliente.codigoPostal??""),
    alias: cadena(inmueble?.alias,c.inmueble.alias), direccionInmueble: cadena(inmueble?.direccion,c.inmueble.direccion), coloniaInmueble: cadena(inmueble?.colonia,c.inmueble.colonia??""), ciudadInmueble: cadena(inmueble?.ciudad,c.inmueble.ciudad), estadoInmueble: cadena(inmueble?.estado,c.inmueble.estado), codigoPostalInmueble: cadena(inmueble?.codigoPostal,c.inmueble.codigoPostal??""),
    m2Terreno: numero(inmueble?.m2Terreno,Number(c.inmueble.superficieTerrenoM2??0)), m2Construccion: numero(inmueble?.m2Construccion,Number(c.inmueble.superficieConstruccionM2??0)), total: numero(datos?.total,Number(version?.total??c.total)),
  };
  const input="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50";

  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-6xl">
    <Link href="/panel/pre-cotizaciones" className="text-sm font-black text-cyan-300">← Pre-cotizaciones</Link>
    <p className="mt-7 text-sm font-black uppercase tracking-[0.28em] text-amber-300">Única fuente de edición</p><h1 className="mt-2 text-4xl font-black">Editar {c.folio}</h1>
    <p className="mt-3 max-w-4xl text-slate-400">Los datos de Cliente e Inmueble solo se modifican aquí. Cada guardado genera una nueva versión documental y obliga a repetir aceptación del cliente y autorización de Certeza Habitacional.</p>
    {propuesta && <p className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm font-bold text-amber-200">Estás viendo la propuesta vigente V{version?.version}. Estos valores todavía no sustituyen los datos maestros de Cliente/Inmueble; se aplicarán únicamente después de nueva aceptación y autorización.</p>}
    <div className="mt-6 grid gap-3 sm:grid-cols-4"><Dato t="Cliente" v={c.cliente.folio}/><Dato t="Versión actual" v={`V${c.versionActual}`}/><Dato t="Pagado preservado" v={Number(c.montoPagado).toLocaleString("es-MX",{style:"currency",currency:"MXN"})}/><Dato t="Estado" v={c.estado.replaceAll("_"," ")}/></div>
    {(mensajes.ok||mensajes.error)&&<p className={`mt-6 rounded-2xl border p-4 font-bold ${mensajes.error?"border-rose-400/20 bg-rose-400/10 text-rose-300":"border-emerald-400/20 bg-emerald-400/10 text-emerald-300"}`}>{mensajes.error??mensajes.ok}</p>}
    <form action={guardarPreCotizacion} className="mt-8 space-y-6"><input type="hidden" name="id" value={c.id}/>
      <section className="rounded-3xl border border-white/10 bg-slate-900 p-6"><h2 className="text-xl font-black text-cyan-300">Cliente</h2><div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Campo label="Nombre *"><input className={input} name="nombre" required defaultValue={valores.nombre}/></Campo><Campo label="Teléfono"><input className={input} name="telefono" defaultValue={valores.telefono}/></Campo><Campo label="Correo *"><input className={input} type="email" name="correo" required defaultValue={valores.correo}/></Campo><Campo label="Tipo de cliente *"><select className={input} name="tipo" defaultValue={valores.tipo}>{Object.values(TipoCliente).map(t=><option key={t} value={t}>{t.replaceAll("_"," ")}</option>)}</select></Campo><Campo label="Empresa"><input className={input} name="empresa" defaultValue={valores.empresa}/></Campo><Campo label="Domicilio"><input className={input} name="direccionCliente" defaultValue={valores.direccionCliente}/></Campo><Campo label="Colonia"><input className={input} name="coloniaCliente" defaultValue={valores.coloniaCliente}/></Campo><Campo label="Ciudad"><input className={input} name="ciudadCliente" defaultValue={valores.ciudadCliente}/></Campo><Campo label="Estado"><input className={input} name="estadoCliente" defaultValue={valores.estadoCliente}/></Campo><Campo label="Código postal"><input className={input} name="codigoPostalCliente" defaultValue={valores.codigoPostalCliente}/></Campo>
      </div></section>
      <section className="rounded-3xl border border-white/10 bg-slate-900 p-6"><h2 className="text-xl font-black text-amber-300">Inmueble</h2><div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Campo label="Alias *"><input className={input} name="alias" required defaultValue={valores.alias}/></Campo><Campo label="Domicilio *"><input className={input} name="direccionInmueble" required defaultValue={valores.direccionInmueble}/></Campo><Campo label="Colonia"><input className={input} name="coloniaInmueble" defaultValue={valores.coloniaInmueble}/></Campo><Campo label="Ciudad *"><input className={input} name="ciudadInmueble" required defaultValue={valores.ciudadInmueble}/></Campo><Campo label="Estado *"><input className={input} name="estadoInmueble" required defaultValue={valores.estadoInmueble}/></Campo><Campo label="Código postal"><input className={input} name="codigoPostalInmueble" defaultValue={valores.codigoPostalInmueble}/></Campo><Campo label="M2 terreno *"><input className={input} type="number" min="0" step="0.01" name="m2Terreno" required defaultValue={valores.m2Terreno}/></Campo><Campo label="M2 construcción *"><input className={input} type="number" min="0.01" step="0.01" name="m2Construccion" required defaultValue={valores.m2Construccion}/></Campo>
      </div></section>
      <section className="rounded-3xl border border-white/10 bg-slate-900 p-6"><h2 className="text-xl font-black text-emerald-300">Pre-cotización</h2><div className="mt-5 grid gap-4 md:grid-cols-3"><Campo label="Importe vigente *"><input className={input} type="number" min="0.01" step="0.01" name="total" required defaultValue={valores.total}/></Campo><Campo label="Vigencia"><input className={input} type="date" name="vigenciaHasta" defaultValue={fechaInput(c.vigenciaHasta)}/></Campo><Campo label="Motivo de modificación *"><input className={input} name="motivo" required placeholder="Qué se corrigió y por qué"/></Campo></div><p className="mt-4 text-sm text-slate-400">Los pagos existentes no se modifican. Si el nuevo importe queda por debajo de lo ya pagado, Caja mostrará una alerta para revisión administrativa.</p></section>
      <div className="flex flex-wrap justify-end gap-3"><Link href="/panel/pre-cotizaciones" className="rounded-full border border-white/15 px-6 py-3 font-black">Cancelar</Link><button className="rounded-full bg-cyan-300 px-7 py-3 font-black text-slate-950">Guardar nueva versión</button></div>
    </form>
  </div></main>;
}
function Campo({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>{children}</label>;}
function Dato({t,v}:{t:string;v:string}){return <div className="rounded-2xl border border-white/10 bg-slate-900 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t}</p><p className="mt-1 font-black text-slate-200">{v}</p></div>;}
