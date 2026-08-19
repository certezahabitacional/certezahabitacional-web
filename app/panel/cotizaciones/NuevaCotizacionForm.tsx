"use client";

import {
  TipoCalculoPrecio,
} from "@prisma/client";
import {
  useMemo,
  useState,
} from "react";

import { crearCotizacion } from "./actions";

type Cliente = {
  id: string;
  nombre: string;
};

type Inmueble = {
  id: string;
  clienteId: string;
  alias: string;
  direccion: string;
  superficieConstruccionM2:
    | number
    | null;
};

type Paquete = {
  id: string;
  nombre: string;
  codigo: string;
  tipoCalculo: TipoCalculoPrecio;
  precioBase: number;
  superficieIncluidaM2: number | null;
  precioM2Adicional: number | null;
  superficieMinimaM2: number | null;
  superficieMaximaM2: number | null;
};

function dinero(valor: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(valor);
}

export default function NuevaCotizacionForm({
  clientes,
  inmuebles,
  paquetes,
}: {
  clientes: Cliente[];
  inmuebles: Inmueble[];
  paquetes: Paquete[];
}) {
  const [clienteId, setClienteId] =
    useState("");

  const [inmuebleId, setInmuebleId] =
    useState("");

  const [paqueteId, setPaqueteId] =
    useState("");

  const [superficieM2, setSuperficieM2] =
    useState(0);

  const [cargosExtra, setCargosExtra] =
    useState(0);

  const [descuento, setDescuento] =
    useState(0);

  const inmueblesCliente = useMemo(
    () =>
      inmuebles.filter(
        (inmueble) =>
          inmueble.clienteId === clienteId,
      ),
    [clienteId, inmuebles],
  );

  const paquete = useMemo(
    () =>
      paquetes.find(
        (item) => item.id === paqueteId,
      ),
    [paqueteId, paquetes],
  );

  const calculo = useMemo(() => {
    if (!paquete) {
      return {
        metrosAdicionales: 0,
        cargoMetros: 0,
        subtotal: 0,
        total: 0,
      };
    }

    const precioBase =
      paquete.tipoCalculo === "POR_M2"
        ? 0
        : paquete.precioBase;

    let metrosAdicionales = 0;
    let cargoMetros = 0;

    if (
      paquete.tipoCalculo === "POR_M2"
    ) {
      metrosAdicionales = superficieM2;

      cargoMetros =
        superficieM2 *
        (paquete.precioM2Adicional ?? 0);
    }

    if (
      paquete.tipoCalculo === "HIBRIDO"
    ) {
      metrosAdicionales = Math.max(
        0,
        superficieM2 -
          (paquete.superficieIncluidaM2 ??
            0),
      );

      cargoMetros =
        metrosAdicionales *
        (paquete.precioM2Adicional ?? 0);
    }

    const subtotal =
      precioBase +
      cargoMetros +
      cargosExtra;

    const total = Math.max(
      0,
      subtotal - descuento,
    );

    return {
      metrosAdicionales,
      cargoMetros,
      subtotal,
      total,
    };
  }, [
    paquete,
    superficieM2,
    cargosExtra,
    descuento,
  ]);

  function seleccionarInmueble(id: string) {
    setInmuebleId(id);

    const inmueble = inmuebles.find(
      (item) => item.id === id,
    );

    if (
      inmueble?.superficieConstruccionM2
    ) {
      setSuperficieM2(
        inmueble.superficieConstruccionM2,
      );
    }
  }

  return (
    <form
      action={crearCotizacion}
      className="grid gap-6 lg:grid-cols-2"
    >
      <div>
        <label className="text-sm font-bold text-slate-300">
          Cliente
        </label>

        <select
          name="clienteId"
          required
          value={clienteId}
          onChange={(event) => {
            setClienteId(event.target.value);
            setInmuebleId("");
            setSuperficieM2(0);
          }}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
        >
          <option value="">
            Selecciona cliente
          </option>

          {clientes.map((cliente) => (
            <option
              key={cliente.id}
              value={cliente.id}
            >
              {cliente.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-300">
          Inmueble
        </label>

        <select
          name="inmuebleId"
          value={inmuebleId}
          disabled={!clienteId}
          onChange={(event) =>
            seleccionarInmueble(
              event.target.value,
            )
          }
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 disabled:opacity-40"
        >
          <option value="">
            Selecciona inmueble
          </option>

          {inmueblesCliente.map(
            (inmueble) => (
              <option
                key={inmueble.id}
                value={inmueble.id}
              >
                {inmueble.alias} —{" "}
                {inmueble.direccion}
              </option>
            ),
          )}
        </select>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-300">
          Superficie a cotizar (m²)
        </label>

        <input
          name="superficieM2"
          type="number"
          min="0"
          step="0.01"
          required
          value={superficieM2 || ""}
          onChange={(event) =>
            setSuperficieM2(
              Number(event.target.value),
            )
          }
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
        />
      </div>

      <div>
        <label className="text-sm font-bold text-slate-300">
          Paquete
        </label>

        <select
          name="paqueteId"
          value={paqueteId}
          required
          onChange={(event) =>
            setPaqueteId(event.target.value)
          }
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
        >
          <option value="">
            Selecciona paquete
          </option>

          {paquetes.map((item) => (
            <option
              key={item.id}
              value={item.id}
            >
              {item.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-bold text-slate-300">
          Cargos adicionales
        </label>

        <input
          name="cargosExtra"
          type="number"
          min="0"
          step="0.01"
          value={cargosExtra || ""}
          onChange={(event) =>
            setCargosExtra(
              Number(event.target.value),
            )
          }
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
        />
      </div>

      <div>
        <label className="text-sm font-bold text-slate-300">
          Descuento
        </label>

        <input
          name="descuento"
          type="number"
          min="0"
          step="0.01"
          value={descuento || ""}
          onChange={(event) =>
            setDescuento(
              Number(event.target.value),
            )
          }
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
        />
      </div>

      <div className="lg:col-span-2">
        <label className="text-sm font-bold text-slate-300">
          Notas para la cotización
        </label>

        <textarea
          name="notas"
          rows={3}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
        />
      </div>

      <div className="lg:col-span-2">
        <label className="text-sm font-bold text-slate-300">
          Observaciones internas
        </label>

        <textarea
          name="observacionesInternas"
          rows={2}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
        />
      </div>

      {paquete && (
        <section className="lg:col-span-2 rounded-3xl border border-cyan-400/20 bg-slate-950 p-6">
          <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
            Cálculo preliminar
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Dato
              titulo="Precio base"
              valor={dinero(
                paquete.tipoCalculo ===
                  "POR_M2"
                  ? 0
                  : paquete.precioBase,
              )}
            />

            <Dato
              titulo="m² adicionales"
              valor={`${calculo.metrosAdicionales.toFixed(
                2,
              )} m²`}
            />

            <Dato
              titulo="Subtotal"
              valor={dinero(
                calculo.subtotal,
              )}
            />

            <Dato
              titulo="TOTAL"
              valor={dinero(calculo.total)}
              destacado
            />
          </div>

          {paquete.superficieMinimaM2 !==
            null && (
            <p className="mt-5 text-xs text-slate-500">
              Rango recomendado:{" "}
              {paquete.superficieMinimaM2} a{" "}
              {paquete.superficieMaximaM2 ??
                "sin límite"}{" "}
              m²
            </p>
          )}
        </section>
      )}

      <div className="lg:col-span-2">
        <button
          type="submit"
          className="rounded-full bg-cyan-400 px-8 py-4 font-black text-slate-950 transition hover:bg-cyan-300"
        >
          Crear cotización
        </button>
      </div>
    </form>
  );
}

function Dato({
  titulo,
  valor,
  destacado = false,
}: {
  titulo: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 ${
        destacado
          ? "bg-cyan-300 text-slate-950"
          : "bg-slate-900"
      }`}
    >
      <p
        className={`text-xs font-black uppercase tracking-widest ${
          destacado
            ? "text-slate-700"
            : "text-slate-500"
        }`}
      >
        {titulo}
      </p>

      <p className="mt-2 text-2xl font-black">
        {valor}
      </p>
    </div>
  );
}