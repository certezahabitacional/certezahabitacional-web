"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

type Concepto = { id: string; concepto: string; estadoV3: string };
type Props = {
  usuarioId: string;
  inspeccionId: string;
  partida: string;
  ruta: string;
  conceptos: Concepto[];
  children: ReactNode[];
};

// La posición de lectura no modifica el resultado ni cierra conceptos.
export default function RecorridoConceptos({ usuarioId, inspeccionId, partida, ruta, conceptos, children }: Props) {
  const clave = `certeza:recorrido:${usuarioId}:${inspeccionId}`;
  const [activo, setActivo] = useState(conceptos.find((c) => c.estadoV3 === "PENDIENTE")?.id ?? conceptos[0]?.id ?? "");
  const [lista, setLista] = useState(false);
  const [preparado, setPreparado] = useState(false);
  const [anteriores, setAnteriores] = useState(conceptos);
  const conceptosRef = useRef(conceptos);
  const cabecera = useRef<HTMLDivElement>(null);

  useEffect(() => { conceptosRef.current = conceptos; }, [conceptos]);

  useEffect(() => {
    function restaurar() {
      const url = new URL(window.location.href);
      const explicito = url.hash.startsWith("#item-") ? url.hash.slice(6) : url.searchParams.get("foco");
      let guardado: string | undefined;
      try {
        const dato = JSON.parse(localStorage.getItem(clave) ?? "null");
        if (dato?.ruta === ruta) guardado = dato.itemId;
      } catch { /* El recorrido funciona aunque el almacenamiento esté bloqueado. */ }
      const destino = [explicito, guardado].find((id) => conceptosRef.current.some((c) => c.id === id));
      if (destino) setActivo(destino);
      setPreparado(true);
    }
    restaurar();
    window.addEventListener("hashchange", restaurar);
    return () => window.removeEventListener("hashchange", restaurar);
  }, [clave, ruta]);

  // Ajustar la selección al recibir resultados nuevos del servidor. Una foto o
  // una interpretación IA mantienen PENDIENTE y no adelantan el recorrido.
  if (conceptos !== anteriores) {
    setAnteriores(conceptos);
    const previo = anteriores.find((c) => c.id === activo);
    const actual = conceptos.find((c) => c.id === activo);
    if (preparado && previo?.estadoV3 === "PENDIENTE" && actual && actual.estadoV3 !== "PENDIENTE") {
      const indice = conceptos.findIndex((c) => c.id === activo);
      const siguiente = conceptos.slice(indice + 1).find((c) => c.estadoV3 === "PENDIENTE")
        ?? conceptos.slice(0, indice).find((c) => c.estadoV3 === "PENDIENTE");
      if (siguiente) setActivo(siguiente.id);
    }
  }

  useEffect(() => {
    if (!preparado || !activo) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("foco");
    url.hash = `item-${activo}`;
    window.history.replaceState(null, "", url);
    cabecera.current?.scrollIntoView({ block: "start" });
    try { localStorage.setItem(clave, JSON.stringify({ ruta, itemId: activo, partida })); } catch { /* Opcional. */ }
  }, [activo, clave, partida, preparado, ruta]);

  const indice = conceptos.findIndex((c) => c.id === activo);
  const actual = conceptos[indice];
  const pendientes = conceptos.filter((c) => c.estadoV3 === "PENDIENTE");
  const proximo = conceptos.slice(indice + 1).find((c) => c.estadoV3 === "PENDIENTE")
    ?? conceptos.slice(0, indice).find((c) => c.estadoV3 === "PENDIENTE");

  function ir(id: string) {
    setActivo(id);
    const url = new URL(window.location.href);
    url.searchParams.delete("foco");
    url.hash = `item-${id}`;
    window.history.replaceState(null, "", url);
    cabecera.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  if (!conceptos.length) return null;
  return (
    <div className="space-y-4">
      <div ref={cabecera} className="scroll-mt-24 rounded-2xl border border-cyan-300/30 bg-slate-950 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-cyan-200">Recorrido guiado · {partida}</p>
        <p aria-live="polite" className="mt-2 font-black">Concepto {indice + 1} de {conceptos.length} · {actual?.concepto}</p>
        <p className="mt-1 text-xs text-slate-400">{conceptos.length - pendientes.length} resueltos · {pendientes.length} pendientes en esta partida. Al confirmar el guardado se muestra el siguiente pendiente.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={indice <= 0} onClick={() => ir(conceptos[indice - 1].id)} className="rounded-xl border border-white/20 px-4 py-3 text-sm font-bold disabled:opacity-30">Anterior</button>
          <button type="button" disabled={indice >= conceptos.length - 1} onClick={() => ir(conceptos[indice + 1].id)} className="rounded-xl border border-white/20 px-4 py-3 text-sm font-bold disabled:opacity-30">Siguiente</button>
          <button type="button" disabled={!proximo} onClick={() => proximo && ir(proximo.id)} className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-30">Ir al siguiente pendiente</button>
          <button type="button" aria-pressed={lista} onClick={() => setLista(!lista)} className="rounded-xl border border-white/20 px-4 py-3 text-sm font-bold">{lista ? "Ver un concepto" : "Ver todos"}</button>
        </div>
        <label className="mt-3 block text-xs text-slate-300">Ir a un concepto
          <select value={activo} onChange={(e) => ir(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 px-3 py-3 text-sm">
            {conceptos.map((c, i) => <option key={c.id} value={c.id}>{i + 1}. {c.concepto} · {c.estadoV3 === "PENDIENTE" ? "Pendiente" : c.estadoV3 === "NO_APLICA" ? "No aplica" : "Revisado"}</option>)}
          </select>
        </label>
        {!pendientes.length && <p role="status" className="mt-3 font-bold text-emerald-200">Conceptos resueltos. Revisa el cierre de esta partida al final de la página.</p>}
      </div>
      {children.map((child, i) => <div key={conceptos[i]?.id ?? i} hidden={!lista && conceptos[i]?.id !== activo}>{child}</div>)}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 p-4">
        <p className="mr-auto text-sm text-slate-300">Concepto {indice + 1} de {conceptos.length} · {actual?.estadoV3 === "PENDIENTE" ? "Pendiente de resolver" : "Resuelto"}</p>
        <button type="button" disabled={!proximo} onClick={() => proximo && ir(proximo.id)} className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-30">Continuar con el siguiente pendiente</button>
      </div>
    </div>
  );
}

function escucharPosicion(notificar: () => void) {
  window.addEventListener("storage", notificar);
  return () => window.removeEventListener("storage", notificar);
}

export function RetomarRecorrido({ usuarioId, inspeccionId }: { usuarioId: string; inspeccionId: string }) {
  const guardado = useSyncExternalStore(escucharPosicion, () => {
    try { return localStorage.getItem(`certeza:recorrido:${usuarioId}:${inspeccionId}`) ?? ""; } catch { return ""; }
  }, () => "");
  let dato;
  try { dato = JSON.parse(guardado || "null"); } catch { return null; }

    const base = `/panel/inspecciones/${inspeccionId}/`;
    if (typeof dato?.ruta !== "string" || !(dato.ruta.startsWith(`${base}campo-v1?`) || dato.ruta.startsWith(`${base}puntos-criticos?`)) || typeof dato.itemId !== "string" || typeof dato.partida !== "string") return null;
    return <a href={`${dato.ruta}#item-${encodeURIComponent(dato.itemId)}`} className="inline-block rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950">Continuar donde me quedé · {dato.partida}</a>;
}
