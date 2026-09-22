"use client";

import { useEffect, useState } from "react";

const PAGE_HEIGHT = 1056;
const TOP_SAFE = 28;
const BOTTOM_SAFE = 54;

export default function ReportPageGuides() {
  const [paginas, setPaginas] = useState(1);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-report-root]");
    if (!root) return;

    let raf = 0;

    const proteger = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const candidatos = Array.from(
          root.querySelectorAll<HTMLElement>(
            '[data-page-unit], .report-figure, .colored-block, .page-row, .report-section > div > p, .report-section h1, .report-section h2, .report-section h3, .report-section h4'
          )
        );

        for (const el of candidatos) el.style.marginTop = "";

        const rootTop = root.getBoundingClientRect().top + window.scrollY;
        for (let pasada = 0; pasada < 3; pasada += 1) {
          let cambio = false;
          for (const el of candidatos) {
            const rect = el.getBoundingClientRect();
            const alto = rect.height;
            if (alto <= 0 || alto > PAGE_HEIGHT - TOP_SAFE - BOTTOM_SAFE) continue;

            const top = rect.top + window.scrollY - rootTop;
            const pagina = Math.max(0, Math.floor(top / PAGE_HEIGHT));
            const offset = top - pagina * PAGE_HEIGHT;
            const finSeguro = PAGE_HEIGHT - BOTTOM_SAFE;

            if (offset + alto > finSeguro) {
              const actual = Number.parseFloat(el.style.marginTop || "0") || 0;
              const salto = PAGE_HEIGHT - offset + TOP_SAFE;
              el.style.marginTop = `${actual + salto}px`;
              cambio = true;
            }
          }
          if (!cambio) break;
        }

        const altoTotal = Math.max(root.scrollHeight, root.getBoundingClientRect().height);
        setPaginas(Math.max(1, Math.ceil(altoTotal / PAGE_HEIGHT)));
      });
    };

    proteger();

    const imgs = Array.from(root.querySelectorAll("img"));
    imgs.forEach((img) => img.addEventListener("load", proteger));
    window.addEventListener("resize", proteger);
    const t1 = window.setTimeout(proteger, 250);
    const t2 = window.setTimeout(proteger, 900);

    return () => {
      cancelAnimationFrame(raf);
      imgs.forEach((img) => img.removeEventListener("load", proteger));
      window.removeEventListener("resize", proteger);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 print:hidden" aria-hidden="true">
      {Array.from({ length: paginas }, (_, index) => {
        const page = index + 1;
        const footerTop = page * PAGE_HEIGHT - 34;
        return (
          <div
            key={page}
            className="absolute left-0 right-0 flex justify-center"
            style={{ top: footerTop }}
          >
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[10px] font-black text-slate-500 shadow-sm">
              Página {page} de {paginas}
            </span>
          </div>
        );
      })}
    </div>
  );
}
