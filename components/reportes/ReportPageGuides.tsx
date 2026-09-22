"use client";

import { useEffect, useState } from "react";

const LETTER_HEIGHT_PX = 1056;

export default function ReportPageGuides() {
  const [paginas, setPaginas] = useState(1);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-report-root]");
    if (!root) return;

    const recalcular = () => {
      const alto = Math.max(root.scrollHeight, root.getBoundingClientRect().height);
      setPaginas(Math.max(1, Math.ceil(alto / LETTER_HEIGHT_PX)));
    };

    recalcular();

    const observer = new ResizeObserver(recalcular);
    observer.observe(root);
    window.addEventListener("resize", recalcular);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recalcular);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 print:hidden" aria-hidden="true">
      {Array.from({ length: paginas }, (_, index) => {
        const page = index + 1;
        const top = index * LETTER_HEIGHT_PX;
        return (
          <div key={page}>
            {page > 1 && (
              <div
                className="absolute left-0 right-0 border-t-2 border-dashed border-slate-400"
                style={{ top }}
              >
                <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-slate-600 shadow-sm">
                  Salto de página
                </span>
              </div>
            )}
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-[10px] font-black text-slate-600 shadow"
              style={{ top: top + LETTER_HEIGHT_PX - 28 }}
            >
              Página {page} de {paginas}
            </div>
          </div>
        );
      })}
    </div>
  );
}
