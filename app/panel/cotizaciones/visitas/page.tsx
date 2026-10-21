import Link from "next/link";
import { RolUsuario, EstadoCotizacion } from "@prisma/client";
import { redirect } from "next/navigation";
import { obtenerUsuarioConAlcanceZona, zonaEfectivaId } from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";
import { esquemaVisitasDisponible, obtenerContextoVisitas } from "@/lib/visitas-cotizacion";
import { ErrorContratoVisita } from "@/lib/visitas-contrato";
import { calcularResumenFinancieroCaja } from "@/lib/caja-finanzas";
import ImporteVisitaForm from "./ImporteVisitaForm";

export default async function VisitasCotizacionPage({ searchParams }: { searchParams: Promise<{ q?: string; cotizacionId?: string }> }) {
  const usuario = await obtenerUsuarioConAlcanceZona("/panel/cotizaciones/visitas");
  if (usuario.rol !== RolUsuario.DIRECTOR && usuario.rol !== RolUsuario.ADMINISTRADOR) redirect("/acceso");
  if (process.env.CH_VISITAS_CONTRATADAS !== "1" || !await esquemaVisitasDisponible(prisma)) {
    return <main className="bg-slate-950 p-8 text-white"><h1 className="text-2xl font-bold">Visitas contratadas</h1><p className="mt-4">Esta función está pendiente de habilitación y pruebas en el ambiente de desarrollo.</p><Link href="/panel/cotizaciones" className="mt-4 inline-block text-cyan-300">Volver a cotizaciones</Link></main>;
  }
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 120);
  const zonaId = zonaEfectivaId(usuario);
  const opciones = await prisma.cotizacion.findMany({
    where: { estado: EstadoCotizacion.AUTORIZADA, ...(zonaId ? { zonaId } : {}), ...(q ? { OR: [{ folio: { contains: q, mode: "insensitive" } }, { cliente: { nombre: { contains: q, mode: "insensitive" } } }] } : {}) },
    select: { id: true, folio: true, cliente: { select: { nombre: true } }, inmueble: { select: { alias: true } } },
    orderBy: { creadoEn: "desc" }, take: 50,
  });
  let contexto: Awaited<ReturnType<typeof obtenerContextoVisitas>> | null = null;
  let error: string | null = null;
  if (params.cotizacionId) {
    try { contexto = await obtenerContextoVisitas(prisma, usuario, params.cotizacionId); }
    catch (e) { if (e instanceof ErrorContratoVisita) error = e.message; else throw e; }
  }
  const dinero = (n: unknown) => Number(n ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  const vinculos = contexto?.vinculos ?? [];
  const folioOrigen = contexto?.origen.folio ?? "";
  const numero = (id: string) => vinculos.find(v => v.cotizacionVisitaId === id)?.numeroVisita ?? 1;
  return <main className="min-h-screen bg-slate-950 px-6 py-8 text-white"><div className="mx-auto max-w-5xl">
    <Link href="/panel/cotizaciones" className="text-cyan-300">Volver a cotizaciones</Link>
    <h1 className="mt-6 text-3xl font-black">Habilitar V2 y visitas posteriores</h1>
    <p className="mt-3 text-slate-400">Mismo folio de origen, importe y pagos independientes por visita. Primero contrata, después cobra y agenda.</p>
    <form className="mt-6 flex gap-3"><input name="q" aria-label="Buscar folio o cliente" defaultValue={q} placeholder="Folio original o cliente" className="min-w-0 flex-1 rounded-xl bg-slate-900 p-3" /><button className="rounded-xl border border-white/20 px-4">Buscar</button></form>
    <form className="mt-3 flex flex-wrap gap-3"><input name="q" type="hidden" value={q} /><select name="cotizacionId" aria-label="Cotización de origen" required defaultValue={params.cotizacionId ?? ""} className="min-w-0 flex-1 rounded-xl bg-slate-900 p-3"><option value="">Selecciona la cotización de origen</option>{opciones.map(c => <option key={c.id} value={c.id}>{c.folio} — {c.cliente.nombre} — {c.inmueble?.alias ?? "Inmueble"}</option>)}</select><button className="rounded-xl bg-cyan-300 px-4 py-3 font-bold text-slate-950">Abrir expediente</button></form>
    <p className="mt-2 text-xs text-slate-500">Se muestran hasta 50 coincidencias; busca el folio para localizar expedientes anteriores.</p>
    {error && <p role="alert" className="mt-5 text-rose-200">{error}</p>}
    {contexto && <>
      <section className="mt-6 rounded-2xl border border-white/10 p-5"><h2 className="font-black text-cyan-200">{folioOrigen}</h2><p>{contexto.origen.cliente.nombre} — {contexto.origen.inmueble?.alias}</p><p className="text-sm text-slate-400">{contexto.origen.inmueble?.direccion}</p></section>
      <div className="mt-5 space-y-3">{[...contexto.visitas].sort((a, b) => numero(a.id) - numero(b.id)).map(v => {
        const financiero = calcularResumenFinancieroCaja({ importe: Number(v.total), pagado: Number(v.montoPagado) });
        return <article key={v.id} className="rounded-2xl border border-white/10 p-4"><h3 className="font-bold">{folioOrigen} — V{numero(v.id)}</h3><p className="mt-2 text-sm">Contratado: {dinero(v.total)} | Pagado: {dinero(v.montoPagado)} | Saldo: {dinero(financiero.saldo)}</p><div className="mt-3 flex flex-wrap gap-4 text-sm text-cyan-300"><Link href={`/panel/caja?q=${encodeURIComponent(v.folio)}`}>Abrir en Caja</Link>{v.inspeccion ? <Link href={`/panel/inspecciones/${v.inspeccion.id}`}>Ver inspección V{numero(v.id)} — {v.inspeccion.estado}</Link> : v.estado === EstadoCotizacion.AUTORIZADA && financiero.cumpleApertura50 ? <Link href={`/panel/inspecciones/nueva?cotizacionId=${v.id}`}>Agendar V{numero(v.id)}</Link> : <span className="text-amber-200">Pendiente de anticipo del 50%</span>}</div></article>;
      })}</div>
      {contexto.bloqueo ? <p className="mt-6 rounded-xl border border-amber-300/20 p-4 text-amber-200">{contexto.bloqueo}</p> : contexto.antecedente && <ImporteVisitaForm key={contexto.antecedente.id} cotizacionId={contexto.origen.id} inspeccionAnteriorId={contexto.antecedente.id} numeroVisita={contexto.numeroVisita} />}
    </>}
  </div></main>;
}
