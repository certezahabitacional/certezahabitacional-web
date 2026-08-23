import Link from "next/link";
import { notFound } from "next/navigation";
import { EstadoCotizacion } from "@prisma/client";

import { obtenerClienteActual } from "@/lib/cliente-actual";
import { prisma } from "@/lib/prisma";

import {
  aceptarCotizacionCliente,
  rechazarCotizacionCliente,
} from "../actions";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

function dinero(valor: unknown) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(valor ?? 0));
}

function fecha(valor: Date | null | undefined) {
  if (!valor) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(valor);
}

export default async function CotizacionClientePage({
  params,
}: Props) {
  const cliente = await obtenerClienteActual();

  const { id } = await params;

  const cotizacion =
    await prisma.cotizacion.findFirst({
      where: {
        id,
        clienteId: cliente.id,
      },

      include: {
        inmueble: true,
        paquete: true,
      },
    });

  if (!cotizacion) {
    notFound();
  }

  const puedeConsultar =
    cotizacion.estado === EstadoCotizacion.ENVIADA ||
    cotizacion.estado === EstadoCotizacion.ACEPTADA ||
    cotizacion.estado === EstadoCotizacion.RECHAZADA;

  if (!puedeConsultar) {
    notFound();
  }

  return (
    <main className="px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <Link
            href="/portal/cotizaciones"
            className="text-sm font-bold text-cyan-300 transition hover:text-cyan-200"
          >
            ← Volver a cotizaciones
          </Link>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900">
          {/* ENCABEZADO */}
          <header className="border-b border-white/10 p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                  Cotización
                </p>

                <h1 className="mt-3 text-3xl font-black">
                  {cotizacion.folio}
                </h1>

                <div className="mt-4">
                  <EstadoBadge
                    estado={cotizacion.estado}
                  />
                </div>
              </div>

              <div className="lg:text-right">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Total cotizado
                </p>

                <p className="mt-2 text-4xl font-black text-cyan-300">
                  {dinero(cotizacion.total)}
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Vigencia hasta:{" "}
                  {fecha(
                    cotizacion.vigenciaHasta,
                  )}
                </p>
              </div>
            </div>
          </header>

          <div className="p-8">
            {/* DATOS DEL SERVICIO */}
            <section>
              <h2 className="text-xl font-black">
                Datos del servicio
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Dato
                  titulo="Cliente"
                  valor={cliente.nombre}
                />

                <Dato
                  titulo="Paquete"
                  valor={
                    cotizacion.paquete?.nombre ??
                    "Sin paquete"
                  }
                />

                <Dato
                  titulo="Inmueble"
                  valor={
                    cotizacion.inmueble
                      ? `${cotizacion.inmueble.alias} — ${cotizacion.inmueble.direccion}`
                      : "Sin inmueble asignado"
                  }
                />

                <Dato
                  titulo="Superficie"
                  valor={`${Number(
                    cotizacion.superficieM2,
                  ).toLocaleString("es-MX")} m²`}
                />
              </div>
            </section>

            {/* DESGLOSE */}
            <section className="mt-8">
              <h2 className="text-xl font-black">
                Desglose económico
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Importe
                  titulo="Precio base"
                  valor={dinero(
                    cotizacion.precioBase,
                  )}
                />

                <Importe
                  titulo="M² adicionales"
                  valor={`${Number(
                    cotizacion.metrosAdicionales,
                  ).toLocaleString("es-MX")} m²`}
                />

                <Importe
                  titulo="Cargo m² adicionales"
                  valor={dinero(
                    cotizacion.cargoMetrosAdicionales,
                  )}
                />

                <Importe
                  titulo="Cargos extra"
                  valor={dinero(
                    cotizacion.cargosExtra,
                  )}
                />

                <Importe
                  titulo="Descuento"
                  valor={dinero(
                    cotizacion.descuento,
                  )}
                />

                <Importe
                  titulo="Subtotal"
                  valor={dinero(
                    cotizacion.subtotal,
                  )}
                />
              </div>

              <div className="mt-5 rounded-3xl bg-slate-950 p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-black uppercase tracking-[0.15em] text-slate-500">
                    Total
                  </p>

                  <p className="text-3xl font-black text-cyan-300">
                    {dinero(cotizacion.total)}
                  </p>
                </div>
              </div>
            </section>

            {/* NOTAS */}
            {cotizacion.notas && (
              <section className="mt-8 rounded-3xl border border-white/10 p-6">
                <h2 className="font-black">
                  Notas de la cotización
                </h2>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                  {cotizacion.notas}
                </p>
              </section>
            )}

            {/* COTIZACIÓN ENVIADA */}
            {cotizacion.estado ===
              EstadoCotizacion.ENVIADA && (
              <section className="mt-8 rounded-3xl border border-cyan-400/30 bg-cyan-400/5 p-6">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                  Acción requerida
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Revisa y responde tu cotización
                </h2>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                  Verifica los datos del servicio,
                  inmueble, superficie, precio y
                  vigencia. Si estás de acuerdo,
                  puedes aceptar la propuesta.
                </p>

                {/* ACEPTAR */}
                <div className="mt-7 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">
                  <p className="font-black text-emerald-300">
                    Aceptar cotización
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Al aceptar confirmas que has
                    revisado la información y estás de
                    acuerdo con continuar con el
                    servicio cotizado.
                  </p>

                  <form
                    action={
                      aceptarCotizacionCliente
                    }
                    className="mt-5"
                  >
                    <input
                      type="hidden"
                      name="id"
                      value={cotizacion.id}
                    />

                    <label className="flex max-w-3xl items-start gap-3 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        name="aceptaTerminos"
                        required
                        className="mt-1 h-4 w-4"
                      />

                      <span>
                        Confirmo que revisé los datos
                        de esta cotización y deseo
                        continuar con el servicio de
                        Certeza Habitacional.
                      </span>
                    </label>

                    <button
                      type="submit"
                      className="mt-5 rounded-full bg-emerald-300 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-200"
                    >
                      Aceptar cotización
                    </button>
                  </form>
                </div>

                {/* RECHAZAR */}
                <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-5">
                  <p className="font-black text-rose-300">
                    Rechazar cotización
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Si no deseas continuar, puedes
                    rechazar esta propuesta. El motivo
                    nos ayudará a dar seguimiento.
                  </p>

                  <form
                    action={
                      rechazarCotizacionCliente
                    }
                    className="mt-5"
                  >
                    <input
                      type="hidden"
                      name="id"
                      value={cotizacion.id}
                    />

                    <textarea
                      name="motivo"
                      rows={4}
                      placeholder="Motivo del rechazo (opcional)"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600"
                    />

                    <button
                      type="submit"
                      className="mt-4 rounded-full bg-rose-300 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-rose-200"
                    >
                      Rechazar cotización
                    </button>
                  </form>
                </div>
              </section>
            )}

            {/* ACEPTADA */}
            {cotizacion.estado ===
              EstadoCotizacion.ACEPTADA && (
              <section className="mt-8 rounded-3xl border border-emerald-400/30 bg-emerald-400/5 p-6">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">
                  Cotización aceptada
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Gracias por tu aceptación
                </h2>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                  Tu cotización fue aceptada
                  correctamente. Certeza Habitacional
                  podrá continuar con el proceso de
                  pago y programación de la
                  inspección.
                </p>
              </section>
            )}

            {/* RECHAZADA */}
            {cotizacion.estado ===
              EstadoCotizacion.RECHAZADA && (
              <section className="mt-8 rounded-3xl border border-rose-400/30 bg-rose-400/5 p-6">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-rose-300">
                  Cotización rechazada
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Esta propuesta fue rechazada
                </h2>

                {cotizacion.motivoRechazo && (
                  <div className="mt-5 rounded-2xl bg-slate-950 p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Motivo
                    </p>

                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {cotizacion.motivoRechazo}
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Dato({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-950 p-5">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
        {titulo}
      </p>

      <p className="mt-2 font-bold text-slate-100">
        {valor}
      </p>
    </div>
  );
}

function Importe({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-950 p-5">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
        {titulo}
      </p>

      <p className="mt-3 text-xl font-black">
        {valor}
      </p>
    </div>
  );
}

function EstadoBadge({
  estado,
}: {
  estado: EstadoCotizacion;
}) {
  let estilos =
    "bg-slate-400/10 text-slate-300";

  if (
    estado === EstadoCotizacion.ENVIADA
  ) {
    estilos =
      "bg-cyan-400/10 text-cyan-300";
  }

  if (
    estado === EstadoCotizacion.ACEPTADA
  ) {
    estilos =
      "bg-emerald-400/10 text-emerald-300";
  }

  if (
    estado === EstadoCotizacion.RECHAZADA
  ) {
    estilos =
      "bg-rose-400/10 text-rose-300";
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${estilos}`}
    >
      {estado.replaceAll("_", " ")}
    </span>
  );
}