"use client";

import { useMemo, useState } from "react";

type Zona = {
  id: string;
  nombre: string;
  codigo: string;
};

type Inspector = {
  id: string;
  usuario: {
    nombre: string;
    zonaId: string | null;
    gerenteId: string | null;
    coordinadorId: string | null;
  };
};

export default function ZonaInspectorSelect({
  zonas,
  inspectores,
  zonaInicial = "",
  inspectorInicial = "",
}: {
  zonas: Zona[];
  inspectores: Inspector[];
  zonaInicial?: string;
  inspectorInicial?: string;
}) {
  const inspectorInicialValido = inspectores.some(
    (inspector) =>
      inspector.id === inspectorInicial &&
      inspector.usuario.zonaId === zonaInicial
  )
    ? inspectorInicial
    : "";

  const [zonaId, setZonaId] = useState(zonaInicial);

  const [inspectorId, setInspectorId] = useState(
    inspectorInicialValido
  );

  const inspectoresDeZona = useMemo(() => {
    if (!zonaId) {
      return [];
    }

    return inspectores.filter(
      (inspector) =>
        inspector.usuario.zonaId !== null &&
        inspector.usuario.zonaId === zonaId
    );
  }, [inspectores, zonaId]);

  function cambiarZona(nuevaZonaId: string) {
    setZonaId(nuevaZonaId);
    setInspectorId("");
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-300">
          Zona *
        </span>

        <select
          name="zonaId"
          required
          value={zonaId}
          onChange={(event) =>
            cambiarZona(event.target.value)
          }
          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
        >
          <option value="">
            Selecciona una opción
          </option>

          {zonas.map((zona) => (
            <option
              key={zona.id}
              value={zona.id}
            >
              {zona.nombre} ({zona.codigo})
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-300">
          Inspector
        </span>

        <select
          name="inspectorId"
          value={inspectorId}
          onChange={(event) =>
            setInspectorId(event.target.value)
          }
          disabled={!zonaId}
          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">
            {!zonaId
              ? "Selecciona primero una zona"
              : "Pendiente de asignar"}
          </option>

          {inspectoresDeZona.map((inspector) => (
            <option
              key={inspector.id}
              value={inspector.id}
            >
              {inspector.usuario.nombre}
              {" · G:"}
              {inspector.usuario.gerenteId ? "Sí" : "No"}
              {" · C:"}
              {inspector.usuario.coordinadorId ? "Sí" : "No"}
            </option>
          ))}
        </select>

        {zonaId &&
          inspectoresDeZona.length === 0 && (
            <p className="mt-2 text-xs font-bold text-amber-300">
              No hay inspectores activos asignados a esta zona.
            </p>
          )}
      </label>
    </div>
  );
}
