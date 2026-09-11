import Link from "next/link";
import { EstadoCotizacion, RolUsuario } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { crearInspeccion } from "./actions";
import CotizacionSelect from "./CotizacionSelect";
import ZonaInspectorSelect from "./ZonaInspectorSelect";

type SearchParams = Promise<{ error?: string; antecedenteId?: string }>;

export default async function NuevaInspeccionPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const usuarioActual = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true, activo: true, zonaId: true },
  });
  if (!usuarioActual?.activo) redirect("/acceso");
  if (![RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR, RolUsuario.GERENTE].includes(usuarioActual.rol)) redirect("/acceso");

  const params = await searchParams;
  const antecedenteId = params.antecedenteId?.trim() || "";
  const antecedente = antecedenteId
    ? await prisma.inspeccion.findUnique({
        where: { id: antecedenteId },
        select: {
          id: true, folio: true, estado: true, clienteId: true, inmuebleId: true, inspectorId: true, plantillaId: true, zonaId: true,
          cliente: { select: { nombre: true } },
          inmueble: { select: { alias: true, direccion: true } },
        },
      })
    : null;
  if (antecedenteId && !antecedente) redirect(`/panel/inspecciones/nueva?error=${encodeURIComponent("La inspección antecedente no existe.")}`);

  const [cotizacionesBase, inspectores, zonas, plantillas] = await Promise.all([
    antecedenteId ? Promise.resolve([]) : prisma.cotizacion.findMany({
      where: { estado: EstadoCotizacion.AUTORIZADA, inmuebleId: { not: null }, inspeccion: null },
      select: {
        id: true, folio: true, clienteId: true, inmuebleId: true, total: true, montoPagado: true, excepcionApertura: true,
        cliente: { select: { nombre: true } }, inmueble: { select: { alias: true } },
      },
      orderBy: { autorizadaEn: "desc" },
    }),
    prisma.inspector.findMany({
      where: { activo: true, usuario: { activo: true, rol: RolUsuario.INSPECTOR } },
      select: { id: true, usuario: { select: { nombre: true, zonaId: true, gerenteId: true, coordinadorId: true } } },
      orderBy: { creadoEn: "asc" },
    }),
    prisma.zona.findMany({ where: { activa: true }, select: { id: true, nombre: true, codigo: true }, orderBy: { nombre: "asc" } }),
    prisma.plantillaInspeccion.findMany({ where: { activa: true }, orderBy: { nombre: "asc" } }),
  ]);

  const cotizaciones = cotizacionesBase
    .filter((c) => {
      const total = Number(c.total);
      const pagado = Number(c.montoPagado);
      return c.excepcionApertura || (total > 0 && pagado / total >= 0.5);
    })
    .map((c) => ({
      id: c.id,
      folio: c.folio,
      clienteId: c.clienteId,
      clienteNombre: c.cliente.nombre,
      inmuebleId: c.inmuebleId!,
      inmuebleAlias: c.inmueble?.alias ?? "Inmueble",
      total: Number(c.total),
      montoPagado: Number(c.montoPagado),
      excepcionApertura: c.excepcionApertura,
    }));

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/panel/inspecciones" className="text-sm font-black text-cyan-300">← Inspecciones</Link>
          {(usuarioActual.rol === RolUsuario.DIRECTOR || usuarioActual.rol === RolUsuario.ADMINISTRADOR) && (
            <Link href="/panel/configuracion/plantillas" className="rounded-full border border-amber-300/30 px-4 py-2 text-sm font-black text-amber-300">Configurar plantillas</Link>
          )}
        </div>

        <p className="mt-7 text-xs font-black uppercase tracking-[0.3em] text-amber-300">Operación comercial vinculada</p>
        <h1 className="mt-3 text-4xl font-black">Nueva inspección</h1>
        <p className="mt-3 max-w-3xl text-slate-400">La primera inspección nace de una cotización aceptada y autorizada. El folio carga automáticamente cliente e inmueble y exige 50% pagado, salvo excepción de Dirección.</p>

        {params.error && <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 font-bold text-rose-200">{params.error}</div>}

        <form action={crearInspeccion} className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-slate-900 p-7">
          {antecedente ? (
            <>
              <input type="hidden" name="antecedenteId" value={antecedente.id} />
              <input type="hidden" name="clienteId" value={antecedente.clienteId} />
              <input type="hidden" name="inmuebleId" value={antecedente.inmuebleId ?? ""} />
              <div className="grid gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-5 md:grid-cols-2">
                <Dato label="Antecedente" value={antecedente.folio} />
                <Dato label="Cliente" value={antecedente.cliente.nombre} />
                <Dato label="Inmueble" value={antecedente.inmueble?.alias ?? "Inmueble"} />
                <Dato label="Dirección" value={antecedente.inmueble?.direccion ?? "—"} />
              </div>
            </>
          ) : cotizaciones.length > 0 ? (
            <CotizacionSelect cotizaciones={cotizaciones} />
          ) : (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-amber-200">No hay cotizaciones disponibles. La cotización debe estar aceptada, autorizada, tener inmueble y contar con al menos 50% pagado o excepción de Dirección.</div>
          )}

          <CampoSelect name="plantillaId" label="Plantilla de inspección *" required defaultValue={antecedente?.plantillaId ?? ""} options={plantillas.map((p) => ({ value: p.id, label: `${p.nombre} · Gerente: ${p.requiereGerenteZona ? "Sí" : "No"} · Coordinador: ${p.requiereCoordinador ? "Sí" : "No"}` }))} />
          <ZonaInspectorSelect zonas={zonas} inspectores={inspectores} zonaInicial={antecedente?.zonaId ?? usuarioActual.zonaId ?? ""} inspectorInicial={antecedente?.inspectorId ?? ""} />

          <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Fecha y hora *</span><input name="fechaProgramada" type="datetime-local" required className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300" /></label>
          <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">Observaciones</span><textarea name="observaciones" rows={4} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300" /></label>

          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm leading-6 text-slate-300"><p className="font-black text-amber-300">Reglas operativas</p><p className="mt-2">La apertura exige 50% de pago. El inicio de trabajo en campo exige 100%. Las excepciones son independientes y solo pueden ser autorizadas por Dirección.</p></div>
          <button type="submit" disabled={!antecedente && cotizaciones.length === 0} className="w-full rounded-full bg-cyan-400 px-6 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Crear y programar inspección</button>
        </form>
      </div>
    </main>
  );
}

function CampoSelect({ name, label, options, required = false, defaultValue = "" }: { name: string; label: string; options: { value: string; label: string }[]; required?: boolean; defaultValue?: string }) {
  return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">{label}</span><select name={name} required={required} defaultValue={defaultValue} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300">{!defaultValue && <option value="">Selecciona una opción</option>}{options.map((o) => <option key={`${name}-${o.value}`} value={o.value}>{o.label}</option>)}</select></label>;
}

function Dato({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}
