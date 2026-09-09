"use client";

import { useMemo, useState } from "react";

type Cliente = {
  id: string;
  nombre: string;
};

type Inmueble = {
  id: string;
  alias: string;
  ciudad: string;
  direccion: string;
  clienteId: string;
};

export default function ClienteInmuebleSelect({
  clientes,
  inmuebles,
}: {
  clientes: Cliente[];
  inmuebles: Inmueble[];
}) {
  const [clienteId, setClienteId] = useState("");
  const [inmuebleId, setInmuebleId] = useState("");

  const inmueblesDelCliente = useMemo(
    () => inmuebles.filter((inmueble) => inmueble.clienteId === clienteId),
    [clienteId, inmuebles],
  );

  function cambiarCliente(nuevoClienteId: string) {
    setClienteId(nuevoClienteId);
    setInmuebleId("");
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-300">
          Cliente *
        </span>

        <select
          name="clienteId"
          required
          value={clienteId}
          onChange={(event) => cambiarCliente(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
        >
          <option value="">Selecciona una opción</option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-300">
          Inmueble *
        </span>

        <select
          name="inmuebleId"
          required
          value={inmuebleId}
          onChange={(event) => setInmuebleId(event.target.value)}
          disabled={!clienteId}
          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">
            {!clienteId
              ? "Selecciona primero un cliente"
              : inmueblesDelCliente.length === 0
                ? "Este cliente no tiene inmuebles registrados"
                : "Selecciona una opción"}
          </option>

          {inmueblesDelCliente.map((inmueble) => (
            <option key={inmueble.id} value={inmueble.id}>
              {inmueble.alias} — {inmueble.ciudad}
            </option>
          ))}
        </select>

        {clienteId && inmueblesDelCliente.length === 0 && (
          <p className="mt-2 text-xs font-bold text-amber-300">
            El cliente seleccionado no tiene inmuebles registrados.
          </p>
        )}
      </label>
    </div>
  );
}
