"use client";

import { useEffect, useState } from "react";

export default function VisorFoto({
  src,
  alt,
  titulo,
}: {
  src: string;
  alt: string;
  titulo: string;
}) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAbierto(false);
      }
    };

    document.addEventListener("keydown", cerrarConEscape);

    return () => {
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="block w-full text-left"
        aria-label={`Ver en grande: ${titulo}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="h-56 w-full object-cover transition hover:opacity-90"
        />

        <span className="block border-t border-white/10 bg-slate-950/70 px-4 py-3 text-center text-sm font-black text-cyan-300">
          🔍 Ver fotografía en grande
        </span>
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 p-4 text-white backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Fotografía: ${titulo}`}
        >
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 pb-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                Evidencia fotográfica
              </p>
              <p className="mt-1 truncate font-black">
                {titulo}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="shrink-0 rounded-full border border-white/20 bg-white/10 px-4 py-2 font-black text-white"
              aria-label="Cerrar fotografía"
            >
              ✕ Cerrar
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="flex min-h-0 flex-1 items-center justify-center"
            aria-label="Cerrar visor"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[78vh] max-w-full object-contain"
            />
          </button>

          <p className="pt-3 text-center text-xs text-slate-400">
            Toca la imagen o “Cerrar” para regresar a las evidencias.
          </p>
        </div>
      )}
    </>
  );
}