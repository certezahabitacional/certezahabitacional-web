import Link from "next/link";
import {
  RolUsuario,
  TipoCalculoPrecio,
} from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import {
  actualizarPaquete,
  cambiarEstadoPaquete,
  crearPaquete,
} from "./actions";

const etiquetasTipo: Record<TipoCalculoPrecio, string> = {
  PRECIO_FIJO: "Precio fijo",
  POR_M2: "Precio por m²",
  HIBRIDO: "Base + m² adicionales",
};

function dinero(valor: unknown) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(Number(valor ?? 0));
}

function metros(valor: unknown) {
  if (valor === null || valor === undefined) {
    return "—";
  }

  return `${Number(valor).toLocaleString("es-MX")} m²`;
}

export default async function PaquetesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const usuarioActual = await prisma.usuario.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      rol: true,
      activo: true,
    },
  });

  if (!usuarioActual || !usuarioActual.activo) {
    redirect("/acceso");
  }

  const puedeGestionar =
    usuarioActual.rol === RolUsuario.DIRECTOR ||
    usuarioActual.rol === RolUsuario.ADMINISTRADOR;

  const puedeConsultar =
    puedeGestionar ||
    usuarioActual.rol === RolUsuario.GERENTE;

  if (!puedeConsultar) {
    redirect("/acceso");
  }

  const paquetes = await prisma.paqueteServicio.findMany({
    orderBy: [
      {
        orden: "asc",
      },
      {
        nombre: "asc",
      },
    ],
  });

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        {/* ENCABEZADO */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/panel"
              className="text-sm font-black text-cyan-300 transition hover:text-cyan-200"
            >
              ← Volver al panel
            </Link>

            <p className="mt-7 text-sm font-black uppercase tracking-[0.3em] text-amber-300">
              CertezaHabitacional v2.0
            </p>

            <h1 className="mt-3 text-4xl font-black">
              Paquetes de servicio
            </h1>

            <p className="mt-3 max-w-3xl text-slate-400">
              {puedeGestionar
                ? "Configura los precios que utilizará Administración para elaborar las cotizaciones."
                : "Consulta los paquetes y condiciones comerciales vigentes en modo solo lectura."}
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-slate-900 px-5 py-3 text-sm">
            <span className="text-slate-500">Paquetes:</span>{" "}
            <strong className="text-cyan-300">{paquetes.length}</strong>
          </div>
        </div>

        {puedeGestionar && (
          <>
        {/* NUEVO PAQUETE */}
        <section className="mt-10 rounded-3xl border border-cyan-400/20 bg-slate-900 p-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
              Nuevo paquete
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Configurar servicio
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Define el precio base, rango de superficie y costo por metro
              cuadrado adicional.
            </p>
          </div>

          <form
            action={crearPaquete}
            className="mt-7 grid gap-5 lg:grid-cols-2"
          >
            <Campo
              label="Nombre del paquete"
              name="nombre"
              placeholder="Inspección Residencial Estándar"
              required
            />

            <Campo
              label="Código"
              name="codigo"
              placeholder="RES_ESTANDAR"
              required
            />

            <div>
              <label className="text-sm font-bold text-slate-300">
                Tipo de cálculo
              </label>

              <select
                name="tipoCalculo"
                defaultValue="HIBRIDO"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
              >
                {Object.values(TipoCalculoPrecio).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {etiquetasTipo[tipo]}
                  </option>
                ))}
              </select>
            </div>

            <Campo
              label="Precio base"
              name="precioBase"
              type="number"
              step="0.01"
              min="0"
              placeholder="2500"
              required
            />

            <Campo
              label="Superficie mínima"
              name="superficieMinimaM2"
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
            />

            <Campo
              label="Superficie máxima"
              name="superficieMaximaM2"
              type="number"
              step="0.01"
              min="0"
              placeholder="120"
            />

            <Campo
              label="m² incluidos en el precio base"
              name="superficieIncluidaM2"
              type="number"
              step="0.01"
              min="0"
              placeholder="120"
            />

            <Campo
              label="Precio por m² adicional"
              name="precioM2Adicional"
              type="number"
              step="0.01"
              min="0"
              placeholder="12"
            />

            <div className="lg:col-span-2">
              <label className="text-sm font-bold text-slate-300">
                Descripción
              </label>

              <textarea
                name="descripcion"
                rows={3}
                placeholder="Describe qué incluye este paquete..."
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
              />
            </div>

            <div className="lg:col-span-2">
              <button
                type="submit"
                className="rounded-full bg-cyan-400 px-7 py-3 font-black text-slate-950 transition hover:bg-cyan-300"
              >
                Crear paquete
              </button>
            </div>
          </form>
        </section>

          </>
        )}

        {/* LISTADO DE PAQUETES */}
        <section className="mt-8 space-y-5">
          {paquetes.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-slate-900/50 px-6 py-16 text-center">
              <p className="text-xl font-black">
                Todavía no hay paquetes.
              </p>

              <p className="mt-2 text-slate-500">
                Crea el primer paquete usando el formulario superior.
              </p>
            </div>
          ) : (
            paquetes.map((paquete) => (
              <article
                key={paquete.id}
                className="rounded-3xl border border-white/10 bg-slate-900 p-7"
              >
                {/* RESUMEN */}
                <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-black">
                        {paquete.nombre}
                      </h2>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          paquete.activo
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-rose-400/10 text-rose-300"
                        }`}
                      >
                        {paquete.activo ? "ACTIVO" : "INACTIVO"}
                      </span>
                    </div>

                    <p className="mt-2 font-mono text-xs text-cyan-300">
                      {paquete.codigo}
                    </p>

                    {paquete.descripcion && (
                      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
                        {paquete.descripcion}
                      </p>
                    )}
                  </div>

                  <div className="text-left xl:text-right">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Precio base
                    </p>

                    <p className="mt-1 text-3xl font-black text-cyan-300">
                      {dinero(paquete.precioBase)}
                    </p>

                    <p className="mt-2 text-xs font-bold text-amber-300">
                      {etiquetasTipo[paquete.tipoCalculo]}
                    </p>
                  </div>
                </div>

                {/* DATOS DEL PAQUETE */}
                <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Dato
                    titulo="Rango mÃ­nimo"
                    valor={metros(paquete.superficieMinimaM2)}
                  />

                  <Dato
                    titulo="Rango mÃ¡ximo"
                    valor={metros(paquete.superficieMaximaM2)}
                  />

                  <Dato
                    titulo="m² incluidos"
                    valor={metros(paquete.superficieIncluidaM2)}
                  />

                  <Dato
                    titulo="m² adicional"
                    valor={
                      paquete.precioM2Adicional !== null
                        ? dinero(paquete.precioM2Adicional)
                        : "—"
                    }
                  />
                </div>

                {puedeGestionar && (
                  <>
                {/* EDITAR */}
                <details className="mt-7 rounded-2xl border border-white/10 bg-slate-950 p-5">
                  <summary className="cursor-pointer font-black text-cyan-300">
                    Editar paquete
                  </summary>

                  <form
                    action={actualizarPaquete}
                    className="mt-6 grid gap-5 lg:grid-cols-2"
                  >
                    <input type="hidden" name="id" value={paquete.id} />

                    <Campo
                      label="Nombre"
                      name="nombre"
                      defaultValue={paquete.nombre}
                      required
                    />

                    <Campo
                      label="Código"
                      name="codigo"
                      defaultValue={paquete.codigo}
                      required
                    />

                    <div>
                      <label className="text-sm font-bold text-slate-300">
                        Tipo de cálculo
                      </label>

                      <select
                        name="tipoCalculo"
                        defaultValue={paquete.tipoCalculo}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300"
                      >
                        {Object.values(TipoCalculoPrecio).map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {etiquetasTipo[tipo]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Campo
                      label="Precio base"
                      name="precioBase"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={Number(paquete.precioBase)}
                      required
                    />

                    <Campo
                      label="Superficie mínima"
                      name="superficieMinimaM2"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={
                        paquete.superficieMinimaM2 === null
                          ? ""
                          : Number(paquete.superficieMinimaM2)
                      }
                    />

                    <Campo
                      label="Superficie máxima"
                      name="superficieMaximaM2"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={
                        paquete.superficieMaximaM2 === null
                          ? ""
                          : Number(paquete.superficieMaximaM2)
                      }
                    />

                    <Campo
                      label="m² incluidos"
                      name="superficieIncluidaM2"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={
                        paquete.superficieIncluidaM2 === null
                          ? ""
                          : Number(paquete.superficieIncluidaM2)
                      }
                    />

                    <Campo
                      label="Precio m² adicional"
                      name="precioM2Adicional"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={
                        paquete.precioM2Adicional === null
                          ? ""
                          : Number(paquete.precioM2Adicional)
                      }
                    />

                    <div className="lg:col-span-2">
                      <label className="text-sm font-bold text-slate-300">
                        Descripción
                      </label>

                      <textarea
                        name="descripcion"
                        rows={3}
                        defaultValue={paquete.descripcion ?? ""}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300"
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <button
                        type="submit"
                        className="rounded-full bg-cyan-400 px-6 py-3 font-black text-slate-950 transition hover:bg-cyan-300"
                      >
                        Guardar cambios
                      </button>
                    </div>
                  </form>
                </details>

                {/* ACTIVAR / DESACTIVAR */}
                <form action={cambiarEstadoPaquete} className="mt-4">
                  <input type="hidden" name="id" value={paquete.id} />

                  <button
                    type="submit"
                    className="text-sm font-black text-amber-300 transition hover:text-amber-200"
                  >
                    {paquete.activo
                      ? "Desactivar paquete"
                      : "Reactivar paquete"}
                  </button>
                </form>
                  </>
                )}

                {!puedeGestionar && (
                  <div className="mt-7 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm text-emerald-200">
                    Consulta de Gerencia en modo solo lectura.
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

function Campo({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  required = false,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string | number;
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="text-sm font-bold text-slate-300">
        {label}
      </label>

      <input
        type={type}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        min={min}
        step={step}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
      />
    </div>
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
    <div className="rounded-2xl bg-slate-950 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-600">
        {titulo}
      </p>

      <p className="mt-2 font-black text-slate-200">
        {valor}
      </p>
    </div>
  );
}