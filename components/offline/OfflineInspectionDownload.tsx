"use client";

import { useMemo, useState } from "react";

const CRITICOS = [
  "HIDRAULICA",
  "SANITARIA",
  "PLUVIAL",
  "GAS",
  "DUCTOS",
  "ELECTRICA",
  "LOSAS_AZOTEA",
];

export default function OfflineInspectionDownload({
  inspeccionId,
  areaIds,
}: {
  inspeccionId: string;
  areaIds: string[];
}) {
  const [estado, setEstado] = useState<"idle" | "downloading" | "ready" | "error">("idle");
  const [detalle, setDetalle] = useState("");

  const urls = useMemo(() => {
    const base = `/panel/inspecciones/${inspeccionId}`;
    return [
      `${base}/flujo`,
      `${base}/areas`,
      ...CRITICOS.map((codigo) => `${base}/puntos-criticos?punto=${codigo}`),
      ...areaIds.map((areaId) => `${base}/campo-v1?area=${encodeURIComponent(areaId)}`),
    ];
  }, [inspeccionId, areaIds]);

  const descargar = async () => {
    if (!navigator.onLine) {
      setEstado("error");
      setDetalle("Necesitas Internet para preparar la inspección por primera vez.");
      return;
    }

    if (!("caches" in window)) {
      setEstado("error");
      setDetalle("Este navegador no admite almacenamiento offline.");
      return;
    }

    setEstado("downloading");
    setDetalle(`Preparando 0/${urls.length} pantallas…`);

    try {
      const cache = await caches.open("certeza-inspecciones-v2");
      let ok = 0;

      for (const url of urls) {
        const response = await fetch(url, {
          credentials: "include",
          cache: "no-store",
          headers: { "x-certeza-offline-download": "1" },
        });

        if (!response.ok) {
          throw new Error(`No fue posible preparar ${url}.`);
        }

        await cache.put(url, response.clone());
        ok += 1;
        setDetalle(`Preparando ${ok}/${urls.length} pantallas…`);
      }

      localStorage.setItem(
        `certeza:offline:${inspeccionId}`,
        JSON.stringify({
          downloadedAt: new Date().toISOString(),
          urls,
        }),
      );

      setEstado("ready");
      setDetalle("Inspección preparada. Ya puedes continuar aunque se pierda Internet.");
    } catch (error) {
      setEstado("error");
      setDetalle(error instanceof Error ? error.message : "No fue posible preparar la inspección.");
    }
  };

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
      <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Trabajo sin conexión</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Descarga las pantallas de esta inspección antes de salir. Las fotografías y cambios compatibles se guardarán en este dispositivo y se sincronizarán al recuperar Internet.
      </p>
      <button
        type="button"
        onClick={descargar}
        disabled={estado === "downloading"}
        className="mt-3 w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
      >
        {estado === "downloading" ? "PREPARANDO INSPECCIÓN…" : "DESCARGAR INSPECCIÓN PARA TRABAJO SIN CONEXIÓN"}
      </button>
      {detalle && (
        <p className={`mt-3 rounded-xl p-3 text-xs font-bold ${
          estado === "error"
            ? "bg-rose-400/10 text-rose-200"
            : estado === "ready"
              ? "bg-emerald-400/10 text-emerald-200"
              : "bg-white/5 text-slate-300"
        }`}>
          {detalle}
        </p>
      )}
    </div>
  );
}
