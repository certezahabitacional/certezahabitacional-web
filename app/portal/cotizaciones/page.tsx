import Link from "next/link";
import { EstadoCotizacion } from "@prisma/client";

import { obtenerClienteActual } from "@/lib/cliente-actual";
import { prisma } from "@/lib/prisma";

function dinero(valor: unknown) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(valor ?? 0));
}

function fecha(valor: Date | null) {
  if (!valor) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(valor);
}

export default async function CotizacionesPortalPage() {
  const cliente = await obtenerClienteActual();

  const cotizaciones = await prisma.cotizacion.findMany({
    where: {
      clienteId: cliente.id,

      estado: {
        in: [
          EstadoCotizacion.ENVIADA,
          EstadoCotizacion.ACEPTADA,
          EstadoCotizacion.RECHAZADA,
        ],
      },
    },

    include: {
      inmueble: {
        select: {
          alias: true,
          direccion: true,
        },
      },

      paquete: {
        select: {
          nombre: true,
        },
      },
    },

    orderBy: {
      actualizadoEn: "desc",
    },
  });

  const pendientes = cotizaciones.filter(
    (cotizacion) =>
      cotizacion.estado === EstadoCotizacion.ENVIADA,
  ).length;

  const aceptadas = cotizaciones.filter(
    (cotizacion) =>
      cotizacion.estado === EstadoCotizacion.ACEPTADA,
  ).length;

  const rechazadas = cotizaciones.filter(
    (cotizacion) =>
      cotizacion.estado === EstadoCotizacion.RECHAZADA,
  ).length;

  return (
    <main className="px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Link
            href="/portal"
            className="text-sm font-bold text-cyan-300"
          >
            ← Volver al portal
          </Link>
        </div>

        <section className="rounded-[2rem] bg-cyan-300 p-8 text-slate-950">
          <p className="text-sm font-black uppercase tracking-[0.25em]">
            Certeza Habitacional
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Mis cotizaciones
          </h1>

          <p className="mt-3 max-w-3xl text-slate-800">
            Consulta las propuestas que Certeza Habitacional
            ha preparado para ti y revisa cuáles requieren
            tu respuesta.
          </p>
        </section>

        <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Metrica
            titulo="Total"
            valor={cotizaciones.length}
          />

          <Metrica
            titulo="Por responder"
            valor={pendientes}
          />

          <Metrica
            titulo="Aceptadas"
            valor={aceptadas}
          />

          <Metrica
            titulo="Rechazadas"
            valor={rechazadas}
          />
        </section>

        {pendientes > 0 && (
          <section className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/5 p-6">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-300">
              Acción requerida
            </p>

            <h2 className="mt-2 text-xl font-black">
              Tienes {pendientes}{" "}
              {pendientes === 1
                ? "cotización pendiente"
                : "cotizaciones pendientes"}{" "}
              de respuesta
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Abre la cotización para revisar el servicio,
              inmueble, importe y vigencia antes de tomar
              una decisión.
            </p>
          </section>
        )}

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
          <header className="border-b border-white/10 p-6">
            <h2 className="text-xl font-black">
              Cotizaciones disponibles
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Historial de propuestas enviadas a tu cuenta.
            </p>
          </header>

          {cotizaciones.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-lg font-black">
                No tienes cotizaciones disponibles.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Cuando Certeza Habitacional te envíe una
                propuesta aparecerá aquí.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {cotizaciones.map((cotizacion) => (
                <Link
                  key={cotizacion.id}
                  href={`/portal/cotizaciones/${cotizacion.id}`}
                  className="block p-6 transition hover:bg-white/[0.03]"
                >
                  <div className="grid gap-6 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="font-black text-cyan-300">
                          {cotizacion.folio}
                        </p>

                        <EstadoBadge
                          estado={cotizacion.estado}
                        />
                      </div>

                      <p className="mt-3 text-lg font-black">
                        {cotizacion.paquete?.nombre ??
                          "Servicio de inspección"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {cotizacion.inmueble
                          ? `${cotizacion.inmueble.alias} — ${cotizacion.inmueble.direccion}`
                          : "Sin inmueble asociado"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Vigencia
                      </p>

                      <p className="mt-1 font-bold">
                        {fecha(cotizacion.vigenciaHasta)}
                      </p>

                      <p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-500">
                        Superficie
                      </p>

                      <p className="mt-1 font-bold">
                        {Number(cotizacion.superficieM2)} m²
                      </p>
                    </div>

                    <div className="lg:text-right">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Total
                      </p>

                      <p className="mt-1 text-2xl font-black text-cyan-300">
                        {dinero(cotizacion.total)}
                      </p>

                      {cotizacion.estado ===
                        EstadoCotizacion.ENVIADA && (
                        <p className="mt-3 text-sm font-black text-amber-300">
                          Revisar y responder →
                        </p>
                      )}

                      {cotizacion.estado ===
                        EstadoCotizacion.ACEPTADA && (
                        <p className="mt-3 text-sm font-black text-emerald-300">
                          Ver cotización →
                        </p>
                      )}

                      {cotizacion.estado ===
                        EstadoCotizacion.RECHAZADA && (
                        <p className="mt-3 text-sm font-black text-rose-300">
                          Ver detalle →
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metrica({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900 p-6">
      <p className="text-sm font-bold text-slate-400">
        {titulo}
      </p>

      <p className="mt-4 text-4xl font-black text-cyan-300">
        {String(valor).padStart(2, "0")}
      </p>
    </article>
  );
}

function EstadoBadge({
  estado,
}: {
  estado: EstadoCotizacion;
}) {
  let estilos =
    "bg-slate-400/10 text-slate-300";

  if (estado === EstadoCotizacion.ENVIADA) {
    estilos =
      "bg-amber-300/10 text-amber-300";
  }

  if (estado === EstadoCotizacion.ACEPTADA) {
    estilos =
      "bg-emerald-300/10 text-emerald-300";
  }

  if (estado === EstadoCotizacion.RECHAZADA) {
    estilos =
      "bg-rose-300/10 text-rose-300";
  }

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-black ${estilos}`}
    >
      {estado.replaceAll("_", " ")}
    </span>
  );
}