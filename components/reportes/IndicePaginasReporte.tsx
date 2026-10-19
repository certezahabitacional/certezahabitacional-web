"use client";

import { useEffect, useState } from "react";

type Entrada = { id: string; titulo: string };

export default function IndicePaginasReporte({ entradas }: { entradas: Entrada[] }) {
  const [paginas, setPaginas] = useState<Record<string, number>>({});

  useEffect(() => {
    const calcular = () => {
      const article = document.querySelector<HTMLElement>("[data-report-root]");
      if (!article) return;
      const top = article.getBoundingClientRect().top + window.scrollY;
      const pxPorMm = 96 / 25.4;
      const altoUtilPagina = 259.4 * pxPorMm; // Carta 279.4 mm - 20 mm de margenes @page.
      const siguiente: Record<string, number> = {};
      for (const entrada of entradas) {
        const nodo = document.getElementById(entrada.id);
        if (!nodo) continue;
        const y = nodo.getBoundingClientRect().top + window.scrollY - top;
        siguiente[entrada.id] = Math.max(1, Math.floor(y / altoUtilPagina) + 1);
      }
      setPaginas(siguiente);
    };

    calcular();
    const raf = requestAnimationFrame(calcular);
    const timer = window.setTimeout(calcular, 600);
    window.addEventListener("resize", calcular);
    window.addEventListener("beforeprint", calcular);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("resize", calcular);
      window.removeEventListener("beforeprint", calcular);
    };
  }, [entradas]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="grid grid-cols-[90px_1fr_80px] bg-slate-950 px-4 py-3 text-[11px] font-black text-white">
        <span>Sección</span><span>Contenido</span><span className="text-right">Página</span>
      </div>
      {entradas.map((entrada, index) => (
        <div key={entrada.id} className="grid grid-cols-[90px_1fr_80px] border-t border-slate-200 px-4 py-3 text-[12px]">
          <span className="font-black">{String(index + 2).padStart(2, "0")}</span>
          <span>{entrada.titulo}</span>
          <span className="text-right font-black">{paginas[entrada.id] ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}
