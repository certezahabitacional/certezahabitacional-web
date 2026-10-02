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
      `${base}/puntos-criticos/hermeticidad?fase=inicio`,
      `${base}/puntos-criticos/hermeticidad?fase=cierre`,
      `${base}/firmas`,
      `${base}/cierre-v1`,
      ...CRITICOS.map((codigo) => `${base}/puntos-criticos?punto=${codigo}`),
      ...areaIds.map((areaId) => `${base}/campo-v1?area=${encodeURIComponent(areaId)}`),
    ];
  }, [inspeccionId, areaIds]);

  const cachearRecursosPantalla = async (response: Response) => {
    const tipo = response.headers.get("content-type") ?? "";
    if (!tipo.includes("text/html")) return;

    const html = await response.clone().text();
    const documento = new DOMParser().parseFromString(html, "text/html");
    const recursos = new Set<string>();

    for (const elemento of documento.querySelectorAll("script[src],link[href]")) {
      const valor =
        elemento instanceof HTMLScriptElement
          ? elemento.src
          : elemento instanceof HTMLLinkElement
            ? elemento.href
            : "";
      if (!valor) continue;

      const recurso = new URL(valor, window.location.origin);
      if (recurso.origin !== window.location.origin) continue;
      if (
        recurso.pathname.startsWith("/_next/static/") ||
        recurso.pathname.startsWith("/branding/")
      ) {
        recursos.add(recurso.href);
      }
    }

    if (recursos.size === 0) return;

    const appCache = await caches.open("certeza-habitacional-v2");
    await Promise.all(
      [...recursos].map(async (url) => {
        const existente = await appCache.match(url);
        if (existente) return;
        const asset = await fetch(url, { credentials: "include", cache: "no-store" });
        if (asset.ok) await appCache.put(url, asset.clone());
      }),
    );
  };

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
    setDetalle("Verificando que la inspección esté completamente preparada…");

    try {
      setDetalle("Preparando automáticamente los 7 Puntos Críticos…");
      const prepare = await fetch(`/api/offline/v1/prepare-critical-points/${inspeccionId}`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const preparado = await prepare.json().catch(() => ({})) as {
        ok?: boolean;
        error?: string;
      };
      if (!prepare.ok || !preparado.ok) {
        throw new Error(preparado.error || "No fue posible preparar los Puntos Críticos para trabajo sin conexión.");
      }

      setDetalle("Verificando preparación integral de la inspección…");
      const readiness = await fetch(`/api/offline/v1/readiness/${inspeccionId}`, {
        credentials: "include",
        cache: "no-store",
      });
      const estadoPrevio = await readiness.json().catch(() => ({})) as {
        ok?: boolean;
        bloqueos?: string[];
        error?: string;
      };

      if (!readiness.ok || !estadoPrevio.ok) {
        const bloqueos = Array.isArray(estadoPrevio.bloqueos) ? estadoPrevio.bloqueos : [];
        throw new Error(
          estadoPrevio.error ||
          (bloqueos.length
            ? `Antes de descargar para trabajo sin conexión completa: ${bloqueos.join(" · ")}`
            : "La inspección todavía no está lista para trabajo sin conexión."),
        );
      }

      setDetalle("Guardando expediente y firmas para uso sin conexión…");
      const [respuestaInspeccion, respuestaFirmas] = await Promise.all([
        fetch(`/api/inspecciones/${inspeccionId}`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`/api/inspecciones/${inspeccionId}/firmas`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);

      if (!respuestaInspeccion.ok || !respuestaFirmas.ok) {
        throw new Error("No fue posible preparar los datos de firmas para uso sin conexión.");
      }

      const [datosInspeccion, datosFirmas] = await Promise.all([
        respuestaInspeccion.json(),
        respuestaFirmas.json(),
      ]);

      localStorage.setItem(
        `certeza:firmas:${inspeccionId}`,
        JSON.stringify({
          inspeccion: datosInspeccion,
          firmas: datosFirmas,
          guardadoEn: new Date().toISOString(),
        }),
      );

      setDetalle(`Preparando 0/${urls.length} pantallas…`);
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
        await cachearRecursosPantalla(response);
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
      setDetalle("Inspección preparada con pantallas y recursos. Ya puedes continuar aunque se pierda Internet.");
    } catch (error) {
      setEstado("error");
      setDetalle(error instanceof Error ? error.message : "No fue posible preparar la inspección.");
    }
  };

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
      <p className="text-xs font-black uppercase tracking-wider text-cyan-200">Trabajo sin conexión</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Antes de salir, este botón prepara automáticamente los 7 Puntos Críticos, valida las áreas y descarga las pantallas necesarias. Las fotografías y cambios compatibles se guardarán en este dispositivo y se sincronizarán al recuperar Internet.
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
