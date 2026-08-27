import Link from "next/link";
import { EstadoCotizacion } from "@prisma/client";
import { notFound } from "next/navigation";

import { obtenerClienteActual } from "@/lib/cliente-actual";
import {
  DATOS_DOCUMENTALES,
  datosContactoDocumento,
} from "@/lib/datos-documentales";
import { prisma } from "@/lib/prisma";

import PrintButton from "./PrintButton";

type Props = {
  params: Promise<{ id: string }>;
};

function dinero(valor: unknown) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(valor ?? 0));
}

function fecha(valor: Date | null | undefined) {
  if (!valor) return "—";

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(valor);
}

export default async function CotizacionImprimirPage({
  params,
}: Props) {
  const cliente = await obtenerClienteActual();
  const { id } = await params;

  const cotizacion = await prisma.cotizacion.findFirst({
    where: {
      id,
      clienteId: cliente.id,
    },
    include: {
      cliente: true,
      inmueble: true,
      paquete: true,
      creadaPor: {
        select: {
          nombre: true,
        },
      },
      autorizadaPor: {
        select: {
          nombre: true,
        },
      },
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

  const contacto = datosContactoDocumento();
  const inmueble = cotizacion.inmueble;

  const direccionCompleta = inmueble
    ? [
        inmueble.direccion,
        inmueble.colonia,
        inmueble.ciudad,
        inmueble.estado,
        inmueble.codigoPostal
          ? `C.P. ${inmueble.codigoPostal}`
          : "",
      ]
        .filter(Boolean)
        .join(", ")
    : "Sin inmueble asociado";

  return (
    <main className="min-h-screen bg-slate-200 px-4 py-8 text-slate-950 print:bg-white print:p-0">
      <style>{`
        @page {
          size: Letter;
          margin: 0;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            background: white !important;
          }

          .no-imprimir {
            display: none !important;
          }

          .pagina-carta {
            width: 215.9mm !important;
            min-height: 279.4mm !important;
            max-height: 279.4mm !important;
            box-shadow: none !important;
            overflow: hidden !important;
          }

          .salto-despues {
            break-after: page;
            page-break-after: always;
          }

          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="no-imprimir mx-auto mb-5 flex max-w-[215.9mm] items-center justify-between gap-4">
        <Link
          href={`/portal/cotizaciones/${cotizacion.id}`}
          className="font-bold text-slate-700"
        >
          ← Volver a la cotización
        </Link>

        <PrintButton />
      </div>

      <article className="mx-auto max-w-[215.9mm]">
        {/* PORTADA */}
        <section className="pagina-carta salto-despues relative flex min-h-[279.4mm] flex-col overflow-hidden bg-slate-950 px-[18mm] py-[16mm] text-white shadow-2xl">
          <div className="absolute right-0 top-0 h-72 w-72 rounded-bl-full bg-amber-300/10" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-tr-full bg-cyan-300/10" />

          <header className="relative z-10 flex items-start justify-between gap-8">
            <div className="flex items-center gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={DATOS_DOCUMENTALES.logo}
                alt="Certeza Habitacional"
                className="h-20 w-auto object-contain"
              />

              <div>
                <p className="text-lg font-black uppercase tracking-[0.12em]">
                  {DATOS_DOCUMENTALES.empresa}
                </p>

                <p className="mt-1 max-w-sm text-xs text-slate-400">
                  {DATOS_DOCUMENTALES.eslogan}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                Documento comercial
              </p>

              <p className="mt-2 font-mono text-sm font-bold">
                {cotizacion.folio}
              </p>
            </div>
          </header>

          <div className="relative z-10 mt-[28mm]">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-amber-300">
              Propuesta de servicios
            </p>

            <h1 className="mt-5 text-6xl font-black leading-none">
              Cotización
            </h1>

            <p className="mt-5 max-w-xl text-xl leading-8 text-slate-300">
              Inspección profesional de vivienda y documentación técnica del inmueble.
            </p>
          </div>

          <div className="relative z-10 mt-[18mm] grid gap-8 md:grid-cols-[1fr_230px]">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <dl className="grid gap-6 sm:grid-cols-2">
                <PortadaDato
                  label="Cliente"
                  value={cotizacion.cliente.nombre}
                />

                <PortadaDato
                  label="Folio"
                  value={cotizacion.folio}
                />

                <PortadaDato
                  label="Inmueble"
                  value={inmueble?.alias ?? "Sin inmueble asociado"}
                />

                <PortadaDato
                  label="Superficie"
                  value={
                    cotizacion.superficieM2
                      ? `${Number(
                          cotizacion.superficieM2,
                        ).toLocaleString("es-MX")} m²`
                      : "No registrada"
                  }
                />

                <div className="sm:col-span-2">
                  <PortadaDato
                    label="Dirección"
                    value={direccionCompleta}
                  />
                </div>

                <PortadaDato
                  label="Fecha"
                  value={fecha(cotizacion.creadoEn)}
                />

                <PortadaDato
                  label="Vigencia"
                  value={fecha(cotizacion.vigenciaHasta)}
                />
              </dl>
            </div>

            <div className="flex flex-col justify-between rounded-[2rem] bg-cyan-300 p-8 text-slate-950">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em]">
                  Total cotizado
                </p>

                <p className="mt-5 break-words text-4xl font-black leading-tight">
                  {dinero(cotizacion.total)}
                </p>

                <p className="mt-2 text-sm font-bold">
                  MXN
                </p>
              </div>

              <div className="mt-10">
                <p className="text-xs font-black uppercase tracking-[0.2em]">
                  Estado
                </p>

                <p className="mt-2 text-sm font-black">
                  {cotizacion.estado.replaceAll("_", " ")}
                </p>
              </div>
            </div>
          </div>

          <footer className="relative z-10 mt-auto flex items-end justify-between gap-6 border-t border-white/10 pt-6 text-xs text-slate-400">
            <div>
              <p className="font-bold text-white">
                {DATOS_DOCUMENTALES.empresa}
              </p>

              {contacto.map((dato) => (
                <p key={dato} className="mt-1">
                  {dato}
                </p>
              ))}
            </div>

            <div className="text-right">
              <p>{cotizacion.folio}</p>
              <p className="mt-1">Página 1 de 2</p>
            </div>
          </footer>
        </section>

        {/* CONTENIDO */}
        <section className="pagina-carta relative flex min-h-[279.4mm] flex-col bg-white px-[16mm] py-[13mm] shadow-2xl">
          <header className="flex items-center justify-between gap-6 border-b-2 border-slate-950 pb-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={DATOS_DOCUMENTALES.logo}
                alt=""
                className="h-12 w-auto object-contain"
              />

              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em]">
                  {DATOS_DOCUMENTALES.empresa}
                </p>

                <p className="mt-1 text-[10px] text-slate-500">
                  Cotización de servicios
                </p>
              </div>
            </div>

            <div className="text-right text-[10px]">
              <p className="font-black">
                {cotizacion.folio}
              </p>
              <p className="mt-1 text-slate-500">
                {cotizacion.cliente.nombre}
              </p>
            </div>
          </header>

          <section className="mt-5">
            <TituloSeccion>
              Datos de la propuesta
            </TituloSeccion>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Dato
                label="Cliente"
                value={cotizacion.cliente.nombre}
              />

              <Dato
                label="Paquete"
                value={cotizacion.paquete?.nombre ?? "Sin paquete"}
              />

              <Dato
                label="Superficie"
                value={
                  cotizacion.superficieM2
                    ? `${Number(
                        cotizacion.superficieM2,
                      ).toLocaleString("es-MX")} m²`
                    : "No registrada"
                }
              />

              <Dato
                label="Vigencia"
                value={fecha(cotizacion.vigenciaHasta)}
              />

              <div className="sm:col-span-2">
                <Dato
                  label="Inmueble"
                  value={
                    inmueble
                      ? `${inmueble.alias} · ${direccionCompleta}`
                      : "Sin inmueble asociado"
                  }
                />
              </div>
            </div>
          </section>

          <section className="mt-5">
            <TituloSeccion>
              Alcance contratado
            </TituloSeccion>

            <div className="mt-3 rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-black">
                {cotizacion.paquete?.nombre ?? "Servicio de inspección"}
              </p>

              <p className="mt-2 text-xs leading-5 text-slate-600">
                {cotizacion.paquete?.descripcion ??
                  "Inspección profesional del inmueble conforme al alcance comercial autorizado para este servicio."}
              </p>
            </div>
          </section>

          <section className="mt-5">
            <TituloSeccion>
              Desglose económico
            </TituloSeccion>

            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <FilaImporte
                concepto="Precio base"
                valor={dinero(cotizacion.precioBase)}
              />

              {Number(cotizacion.metrosAdicionales) > 0 && (
                <FilaImporte
                  concepto={`Metros adicionales (${Number(
                    cotizacion.metrosAdicionales,
                  ).toLocaleString("es-MX")} m²)`}
                  valor={dinero(cotizacion.cargoMetrosAdicionales)}
                />
              )}

              {Number(cotizacion.cargosExtra) > 0 && (
                <FilaImporte
                  concepto="Cargos adicionales"
                  valor={dinero(cotizacion.cargosExtra)}
                />
              )}

              {Number(cotizacion.descuento) > 0 && (
                <FilaImporte
                  concepto="Descuento"
                  valor={`-${dinero(cotizacion.descuento)}`}
                />
              )}

              <FilaImporte
                concepto="Subtotal"
                valor={dinero(cotizacion.subtotal)}
                fuerte
              />

              <FilaImporte
                concepto="TOTAL COTIZADO"
                valor={dinero(cotizacion.total)}
                total
              />
            </div>

            <p className="mt-2 text-[9px] leading-4 text-slate-500">
              Este documento reproduce los importes registrados en el sistema. El modelo actual no almacena IVA como campo separado, por lo que no se desglosa un impuesto que no esté registrado explícitamente.
            </p>
          </section>

          <section className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <TituloSeccion>
                Elaboración
              </TituloSeccion>

              <div className="mt-3 space-y-2 rounded-xl border border-slate-200 p-4 text-xs">
                <Linea
                  label="Elaboró"
                  value={
                    cotizacion.creadaPor?.nombre ??
                    DATOS_DOCUMENTALES.empresa
                  }
                />

                <Linea
                  label="Autorizó"
                  value={cotizacion.autorizadaPor?.nombre ?? "—"}
                />

                <Linea
                  label="Fecha"
                  value={fecha(cotizacion.autorizadaEn)}
                />
              </div>
            </div>

            <div>
              <TituloSeccion>
                Estado
              </TituloSeccion>

              <div className="mt-3 space-y-2 rounded-xl border border-slate-200 p-4 text-xs">
                <Linea
                  label="Estado"
                  value={cotizacion.estado.replaceAll("_", " ")}
                />

                <Linea
                  label="Emitida"
                  value={fecha(cotizacion.creadoEn)}
                />

                <Linea
                  label="Vigente hasta"
                  value={fecha(cotizacion.vigenciaHasta)}
                />
              </div>
            </div>
          </section>

          {cotizacion.notas && (
            <section className="mt-5">
              <TituloSeccion>
                Notas de la cotización
              </TituloSeccion>

              <div className="mt-3 rounded-xl border border-slate-200 p-4">
                <p className="whitespace-pre-wrap text-xs leading-5 text-slate-700">
                  {cotizacion.notas}
                </p>
              </div>
            </section>
          )}

          <section className="mt-5">
            <TituloSeccion>
              Aceptación
            </TituloSeccion>

            <p className="mt-3 text-xs leading-5 text-slate-600">
              La aceptación electrónica registrada en el portal del cliente constituye la manifestación de conformidad con esta propuesta comercial y permite continuar con el flujo administrativo correspondiente.
            </p>

            <div className="mt-7 grid gap-8 sm:grid-cols-2">
              <div className="border-t border-slate-400 pt-3 text-center text-[10px]">
                <p className="font-black">
                  {cotizacion.cliente.nombre}
                </p>
                <p className="mt-1 text-slate-500">
                  Cliente / representante
                </p>
              </div>

              <div className="border-t border-slate-400 pt-3 text-center text-[10px]">
                <p className="font-black">
                  {DATOS_DOCUMENTALES.empresa}
                </p>
                <p className="mt-1 text-slate-500">
                  Empresa prestadora del servicio
                </p>
              </div>
            </div>
          </section>

          <footer className="mt-auto flex items-end justify-between gap-6 border-t border-slate-200 pt-3 text-[9px] leading-4 text-slate-500">
            <div>
              <p className="font-bold text-slate-700">
                {DATOS_DOCUMENTALES.empresa}
              </p>
              {contacto.length > 0 && (
                <p className="mt-1">
                  {contacto.join(" · ")}
                </p>
              )}
            </div>

            <div className="text-right">
              <p>{cotizacion.folio}</p>
              <p>Página 2 de 2</p>
            </div>
          </footer>
        </section>
      </article>
    </main>
  );
}

function PortadaDato({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-widest text-cyan-300">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-bold leading-6 text-white">
        {value}
      </dd>
    </div>
  );
}

function TituloSeccion({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <h2 className="border-b border-slate-950 pb-2 text-xs font-black uppercase tracking-[0.16em]">
      {children}
    </h2>
  );
}

function Dato({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-100 p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xs font-bold leading-5">
        {value}
      </p>
    </div>
  );
}

function FilaImporte({
  concepto,
  valor,
  fuerte = false,
  total = false,
}: {
  concepto: string;
  valor: string;
  fuerte?: boolean;
  total?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-5 border-b border-slate-200 px-4 py-2 last:border-b-0 ${
        total
          ? "bg-slate-950 text-white"
          : fuerte
            ? "bg-slate-100"
            : "bg-white"
      }`}
    >
      <p className={total || fuerte ? "text-xs font-black" : "text-xs text-slate-600"}>
        {concepto}
      </p>

      <p className={total ? "text-base font-black text-cyan-300" : "text-xs font-black"}>
        {valor}
      </p>
    </div>
  );
}

function Linea({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
      <span className="text-slate-500">
        {label}
      </span>
      <strong className="text-right">
        {value}
      </strong>
    </div>
  );
}
