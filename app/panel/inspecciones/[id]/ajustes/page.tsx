import { Prisma, RolUsuario } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { obtenerUsuarioConAlcanceZona, puedeAccederZona } from "@/lib/alcance-zona";
import { prisma } from "@/lib/prisma";
import {
  aplicarAjusteComercial,
  proponerAjusteComercial,
  registrarAceptacionAjuste,
  resolverAjusteComercial,
} from "@/app/panel/ajustes-comerciales/actions";

type Ajuste = {
  id: string;
  tipo: string;
  origen: string;
  concepto: string;
  motivo: string;
  monto: Prisma.Decimal;
  estado: string;
  requiereAceptacionCliente: boolean;
  aceptadoCliente: boolean;
  propuestoEn: Date;
  autorizadoEn: Date | null;
  rechazadoEn: Date | null;
  motivoResolucion: string | null;
  aplicadoEn: Date | null;
  versionCotizacionOrigen: number | null;
  versionCotizacionAplicada: number | null;
  propuestoPor: string | null;
  autorizadoPor: string | null;
  rechazadoPor: string | null;
  aplicadoPor: string | null;
};

function dinero(valor: unknown) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(valor ?? 0));
}

function fecha(valor: Date | null, zonaHoraria: string) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: zonaHoraria,
  }).format(valor);
}

export default async function AjustesInspeccionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const mensajes = await searchParams;
  const usuario = await obtenerUsuarioConAlcanceZona(`/panel/inspecciones/${id}/ajustes`);
  const rolesPermitidos: RolUsuario[] = [RolUsuario.DIRECTOR, RolUsuario.ADMINISTRADOR, RolUsuario.INSPECTOR];

  if (!rolesPermitidos.includes(usuario.rol)) {
    redirect("/acceso");
  }

  const inspeccion = await prisma.inspeccion.findUnique({
    where: { id },
    select: {
      id: true,
      folio: true,
      estado: true,
      zonaId: true,
      zonaHoraria: true,
      numeroInspeccion: true,
      inspectorId: true,
      inspector: { select: { usuarioId: true } },
      cliente: { select: { nombre: true } },
      inmueble: { select: { alias: true } },
      cotizacion: {
        select: {
          id: true,
          folio: true,
          versionActual: true,
          total: true,
          montoPagado: true,
          estadoPago: true,
        },
      },
    },
  });

  if (!inspeccion) notFound();
  if (!puedeAccederZona(usuario, inspeccion.zonaId)) redirect("/acceso");

  if (
    usuario.rol === RolUsuario.INSPECTOR &&
    (!usuario.inspector?.id ||
      inspeccion.inspectorId !== usuario.inspector.id ||
      inspeccion.inspector?.usuarioId !== usuario.id)
  ) {
    redirect("/acceso");
  }

  if (!inspeccion.cotizacion) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Link href={`/panel/inspecciones/${id}`} className="text-sm font-black text-cyan-300">
            ← Expediente
          </Link>
          <section className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-400/5 p-6">
            <h1 className="text-2xl font-black">Ajustes comerciales</h1>
            <p className="mt-3 text-amber-200">Esta inspección no tiene una cotización relacionada; no es posible registrar ajustes comerciales.</p>
          </section>
        </div>
      </main>
    );
  }

  const ajustes = await prisma.$queryRaw<Ajuste[]>`
    SELECT
      a."id", a."tipo", a."origen", a."concepto", a."motivo", a."monto", a."estado",
      a."requiereAceptacionCliente", a."aceptadoCliente", a."propuestoEn", a."autorizadoEn",
      a."rechazadoEn", a."motivoResolucion", a."aplicadoEn", a."versionCotizacionOrigen",
      a."versionCotizacionAplicada",
      up."nombre" AS "propuestoPor",
      ua."nombre" AS "autorizadoPor",
      ur."nombre" AS "rechazadoPor",
      uap."nombre" AS "aplicadoPor"
    FROM "AjusteComercial" a
    LEFT JOIN "Usuario" up ON up."id" = a."propuestoPorId"
    LEFT JOIN "Usuario" ua ON ua."id" = a."autorizadoPorId"
    LEFT JOIN "Usuario" ur ON ur."id" = a."rechazadoPorId"
    LEFT JOIN "Usuario" uap ON uap."id" = a."aplicadoPorId"
    WHERE a."inspeccionId" = ${id}
    ORDER BY a."propuestoEn" DESC
  `;

  const destino = `/panel/inspecciones/${id}/ajustes`;
  const total = Number(inspeccion.cotizacion.total);
  const pagado = Number(inspeccion.cotizacion.montoPagado);
  const saldo = Math.max(0, total - pagado);
  const pendientes = ajustes.filter((a) => a.estado === "PENDIENTE" || (a.estado === "AUTORIZADO" && !a.aplicadoEn));
  const puedeGestionar = usuario.rol === RolUsuario.DIRECTOR || usuario.rol === RolUsuario.ADMINISTRADOR;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/panel/inspecciones/${id}`} className="text-sm font-black text-cyan-300">
            ← Expediente
          </Link>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-300">
            {inspeccion.folio} · V{inspeccion.numeroInspeccion}
          </span>
        </div>

        <header className="mt-5 rounded-3xl border border-white/10 bg-slate-900 p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Control comercial documentado</p>
          <h1 className="mt-2 text-3xl font-black">Ajustes de la inspección</h1>
          <p className="mt-2 text-slate-400">
            {inspeccion.cliente.nombre} · {inspeccion.inmueble?.alias ?? "Inmueble"} · {inspeccion.cotizacion.folio}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Resumen etiqueta="Versión" valor={`V${inspeccion.cotizacion.versionActual}`} />
            <Resumen etiqueta="Total vigente" valor={dinero(total)} />
            <Resumen etiqueta="Pagado" valor={dinero(pagado)} />
            <Resumen etiqueta="Saldo" valor={dinero(saldo)} />
          </div>

          {pendientes.length > 0 && (
            <p className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm font-bold text-amber-200">
              Hay {pendientes.length} ajuste(s) sin concluir. El certificado permanecerá bloqueado hasta resolverlos y, cuando aplique, registrar aceptación y aplicación.
            </p>
          )}
        </header>

        {(mensajes.ok || mensajes.error) && (
          <p className={`mt-5 rounded-2xl border p-4 font-bold ${mensajes.error ? "border-rose-400/20 bg-rose-400/10 text-rose-300" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"}`}>
            {mensajes.error ?? mensajes.ok}
          </p>
        )}

        <section className="mt-6 rounded-3xl border border-cyan-400/20 bg-slate-900 p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Nuevo ajuste</p>
          <h2 className="mt-2 text-xl font-black">Registrar cargo o descuento propuesto</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Registrar un ajuste no altera el total de inmediato. Primero queda documentado y debe seguir su flujo de autorización y aceptación cuando corresponda.
          </p>

          <form action={proponerAjusteComercial} className="mt-5 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="cotizacionId" value={inspeccion.cotizacion.id} />
            <input type="hidden" name="inspeccionId" value={id} />
            <input type="hidden" name="origen" value="INSPECCION" />
            <input type="hidden" name="destino" value={destino} />
            <Campo label="Tipo">
              <select name="tipo" required className={inputClase}>
                <option value="CARGO">Cargo adicional</option>
                <option value="DESCUENTO">Descuento propuesto</option>
              </select>
            </Campo>
            <Campo label="Monto">
              <input name="monto" type="number" min="0.01" step="0.01" required className={inputClase} />
            </Campo>
            <Campo label="Concepto">
              <input name="concepto" required maxLength={180} className={inputClase} placeholder="Ej. revisión especial solicitada por el cliente" />
            </Campo>
            <Campo label="Motivo / antecedente">
              <input name="motivo" required maxLength={500} className={inputClase} placeholder="Qué originó el ajuste" />
            </Campo>
            <div className="md:col-span-2 flex justify-end">
              <button className="rounded-full bg-cyan-300 px-6 py-3 font-black text-slate-950">Registrar propuesta</button>
            </div>
          </form>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-slate-900 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Historial</p>
              <h2 className="mt-2 text-xl font-black">Ajustes documentados</h2>
            </div>
            <span className="text-sm font-bold text-slate-500">{ajustes.length} registro(s)</span>
          </div>

          {ajustes.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-white/10 bg-slate-950 p-5 text-sm text-slate-400">No existen ajustes comerciales para esta inspección.</p>
          ) : (
            <div className="mt-5 space-y-4">
              {ajustes.map((ajuste) => {
                const autorizadoPendiente = ajuste.estado === "AUTORIZADO" && !ajuste.aplicadoEn;
                const puedeAutorizar =
                  ajuste.estado === "PENDIENTE" &&
                  (ajuste.tipo === "DESCUENTO" ? usuario.rol === RolUsuario.DIRECTOR : puedeGestionar);

                return (
                  <article key={ajuste.id} className="rounded-2xl border border-white/10 bg-slate-950 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${ajuste.tipo === "CARGO" ? "bg-amber-400/10 text-amber-300" : "bg-violet-400/10 text-violet-300"}`}>
                        {ajuste.tipo === "CARGO" ? "CARGO" : "DESCUENTO"}
                      </span>
                      <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black text-slate-300">{ajuste.estado}</span>
                      {ajuste.aplicadoEn && <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">APLICADO</span>}
                      {ajuste.requiereAceptacionCliente && !ajuste.aceptadoCliente && ajuste.estado === "AUTORIZADO" && (
                        <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">PENDIENTE CLIENTE</span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black">{ajuste.concepto}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{ajuste.motivo}</p>
                      </div>
                      <p className="text-xl font-black text-white">{dinero(ajuste.monto)}</p>
                    </div>

                    <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                      <p>Propuesto: {fecha(ajuste.propuestoEn, inspeccion.zonaHoraria)} · {ajuste.propuestoPor ?? "Usuario"}</p>
                      <p>Origen: {ajuste.origen.replaceAll("_", " ")}</p>
                      <p>Versión origen: {ajuste.versionCotizacionOrigen ? `V${ajuste.versionCotizacionOrigen}` : "—"}</p>
                      <p>Versión aplicada: {ajuste.versionCotizacionAplicada ? `V${ajuste.versionCotizacionAplicada}` : "—"}</p>
                      {ajuste.autorizadoEn && <p>Autorizado: {fecha(ajuste.autorizadoEn, inspeccion.zonaHoraria)} · {ajuste.autorizadoPor ?? "Usuario"}</p>}
                      {ajuste.rechazadoEn && <p>Rechazado: {fecha(ajuste.rechazadoEn, inspeccion.zonaHoraria)} · {ajuste.rechazadoPor ?? "Usuario"}</p>}
                      {ajuste.aplicadoEn && <p>Aplicado: {fecha(ajuste.aplicadoEn, inspeccion.zonaHoraria)} · {ajuste.aplicadoPor ?? "Usuario"}</p>}
                    </div>

                    {ajuste.motivoResolucion && (
                      <p className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">Resolución: {ajuste.motivoResolucion}</p>
                    )}

                    {puedeGestionar && ajuste.estado === "PENDIENTE" && (
                      <form action={resolverAjusteComercial} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                        <input type="hidden" name="ajusteId" value={ajuste.id} />
                        <input type="hidden" name="destino" value={destino} />
                        <input name="motivoResolucion" required className={inputClase} placeholder="Motivo de autorización o rechazo" />
                        <button name="decision" value="AUTORIZAR" disabled={!puedeAutorizar} className="rounded-full bg-emerald-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-30">
                          Autorizar
                        </button>
                        <button name="decision" value="RECHAZAR" className="rounded-full border border-rose-400/30 px-5 py-3 font-black text-rose-300">Rechazar</button>
                      </form>
                    )}

                    {puedeGestionar && autorizadoPendiente && ajuste.requiereAceptacionCliente && !ajuste.aceptadoCliente && (
                      <form action={registrarAceptacionAjuste} className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <input type="hidden" name="ajusteId" value={ajuste.id} />
                        <input type="hidden" name="destino" value={destino} />
                        <input name="motivo" required className={`${inputClase} flex-1`} placeholder="Medio/antecedente de aceptación del cliente" />
                        <button className="rounded-full bg-cyan-300 px-5 py-3 font-black text-slate-950">Registrar aceptación</button>
                      </form>
                    )}

                    {puedeGestionar && autorizadoPendiente && (!ajuste.requiereAceptacionCliente || ajuste.aceptadoCliente) && (
                      <form action={aplicarAjusteComercial} className="mt-4 flex justify-end">
                        <input type="hidden" name="ajusteId" value={ajuste.id} />
                        <input type="hidden" name="destino" value={destino} />
                        <button className="rounded-full bg-amber-300 px-5 py-3 font-black text-slate-950">Aplicar a cotización y generar nueva versión</button>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const inputClase = "w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Resumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{etiqueta}</p>
      <p className="mt-2 font-black text-white">{valor}</p>
    </div>
  );
}
