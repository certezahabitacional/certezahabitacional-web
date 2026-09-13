import { EstadoCotizacion, RolUsuario, TipoCliente } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardarPreCotizacion } from "./actions";

function fechaInput(fecha: Date | null) {
  if (!fecha) return "";
  return fecha.toISOString().slice(0, 10);
}

export default async function EditarPreCotizacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true },
  });
  if (!usuario?.activo || (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR)) redirect("/acceso");

  const { id } = await params;
  const mensajes = await searchParams;
  const c = await prisma.cotizacion.findUnique({
    where: { id },
    select: {
      id: true,
      folio: true,
      estado: true,
      versionActual: true,
      total: true,
      montoPagado: true,
      vigenciaHasta: true,
      cliente: {
        select: {
          folio: true,
          nombre: true,
          telefono: true,
          correo: true,
          tipo: true,
          empresa: true,
          direccion: true,
          colonia: true,
          ciudad: true,
          estado: true,
          codigoPostal: true,
        },
      },
      inmueble: {
        select: {
          alias: true,
          direccion: true,
          colonia: true,
          ciudad: true,
          estado: true,
          codigoPostal: true,
          superficieTerrenoM2: true,
          superficieConstruccionM2: true,
        },
      },
    },
  });

  if (!c) notFound();
  if (![EstadoCotizacion.BORRADOR, EstadoCotizacion.ENVIADA, EstadoCotizacion.ACEPTADA].includes(c.estado)) redirect("/panel/cotizaciones");
  if (!c.inmueble) notFound();

  const input = "w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/panel/pre-cotizaciones" className="text-sm font-black text-cyan-300">← Pre-cotizaciones</Link>
        <p className="mt-7 text-sm font-black uppercase tracking-[0.28em] text-amber-300">Única fuente de edición</p>
        <h1 className="mt-2 text-4xl font-black">Editar {c.folio}</h1>
        <p className="mt-3 max-w-4xl text-slate-400">
          Los datos de Cliente e Inmueble solo se modifican aquí. Cada guardado genera una nueva versión documental y obliga a repetir aceptación del cliente y autorización de Certeza Habitacional.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Dato t="Cliente" v={c.cliente.folio} />
          <Dato t="Versión actual" v={`V${c.versionActual}`} />
          <Dato t="Pagado preservado" v={Number(c.montoPagado).toLocaleString("es-MX", { style: "currency", currency: "MXN" })} />
          <Dato t="Estado" v={c.estado.replaceAll("_", " ")} />
        </div>

        {(mensajes.ok || mensajes.error) && (
          <p className={`mt-6 rounded-2xl border p-4 font-bold ${mensajes.error ? "border-rose-400/20 bg-rose-400/10 text-rose-300" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"}`}>
            {mensajes.error ?? mensajes.ok}
          </p>
        )}

        <form action={guardarPreCotizacion} className="mt-8 space-y-6">
          <input type="hidden" name="id" value={c.id} />

          <section className="rounded-3xl border border-white/10 bg-slate-900 p-6">
            <h2 className="text-xl font-black text-cyan-300">Cliente</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Campo label="Nombre *"><input className={input} name="nombre" required defaultValue={c.cliente.nombre} /></Campo>
              <Campo label="Teléfono"><input className={input} name="telefono" defaultValue={c.cliente.telefono ?? ""} /></Campo>
              <Campo label="Correo *"><input className={input} type="email" name="correo" required defaultValue={c.cliente.correo ?? ""} /></Campo>
              <Campo label="Tipo de cliente *"><select className={input} name="tipo" defaultValue={c.cliente.tipo}>{Object.values(TipoCliente).map((t) => <option key={t} value={t}>{t.replaceAll("_", " ")}</option>)}</select></Campo>
              <Campo label="Empresa"><input className={input} name="empresa" defaultValue={c.cliente.empresa ?? ""} /></Campo>
              <Campo label="Domicilio"><input className={input} name="direccionCliente" defaultValue={c.cliente.direccion ?? ""} /></Campo>
              <Campo label="Colonia"><input className={input} name="coloniaCliente" defaultValue={c.cliente.colonia ?? ""} /></Campo>
              <Campo label="Ciudad"><input className={input} name="ciudadCliente" defaultValue={c.cliente.ciudad ?? ""} /></Campo>
              <Campo label="Estado"><input className={input} name="estadoCliente" defaultValue={c.cliente.estado ?? ""} /></Campo>
              <Campo label="Código postal"><input className={input} name="codigoPostalCliente" defaultValue={c.cliente.codigoPostal ?? ""} /></Campo>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-900 p-6">
            <h2 className="text-xl font-black text-amber-300">Inmueble</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Campo label="Alias *"><input className={input} name="alias" required defaultValue={c.inmueble.alias} /></Campo>
              <Campo label="Domicilio *"><input className={input} name="direccionInmueble" required defaultValue={c.inmueble.direccion} /></Campo>
              <Campo label="Colonia"><input className={input} name="coloniaInmueble" defaultValue={c.inmueble.colonia ?? ""} /></Campo>
              <Campo label="Ciudad *"><input className={input} name="ciudadInmueble" required defaultValue={c.inmueble.ciudad} /></Campo>
              <Campo label="Estado *"><input className={input} name="estadoInmueble" required defaultValue={c.inmueble.estado} /></Campo>
              <Campo label="Código postal"><input className={input} name="codigoPostalInmueble" defaultValue={c.inmueble.codigoPostal ?? ""} /></Campo>
              <Campo label="M2 terreno *"><input className={input} type="number" min="0" step="0.01" name="m2Terreno" required defaultValue={c.inmueble.superficieTerrenoM2?.toString() ?? "0"} /></Campo>
              <Campo label="M2 construcción *"><input className={input} type="number" min="0.01" step="0.01" name="m2Construccion" required defaultValue={c.inmueble.superficieConstruccionM2?.toString() ?? ""} /></Campo>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-900 p-6">
            <h2 className="text-xl font-black text-emerald-300">Pre-cotización</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Campo label="Importe vigente *"><input className={input} type="number" min="0.01" step="0.01" name="total" required defaultValue={c.total.toString()} /></Campo>
              <Campo label="Vigencia"><input className={input} type="date" name="vigenciaHasta" defaultValue={fechaInput(c.vigenciaHasta)} /></Campo>
              <Campo label="Motivo de modificación *"><input className={input} name="motivo" required placeholder="Qué se corrigió y por qué" /></Campo>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Los pagos existentes no se modifican. Si el nuevo importe queda por debajo de lo ya pagado, Caja mostrará una alerta para revisión administrativa.
            </p>
          </section>

          <div className="flex flex-wrap justify-end gap-3">
            <Link href="/panel/pre-cotizaciones" className="rounded-full border border-white/15 px-6 py-3 font-black">Cancelar</Link>
            <button className="rounded-full bg-cyan-300 px-7 py-3 font-black text-slate-950">Guardar nueva versión</button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>{children}</label>;
}

function Dato({ t, v }: { t: string; v: string }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-900 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t}</p><p className="mt-1 font-black text-slate-200">{v}</p></div>;
}
