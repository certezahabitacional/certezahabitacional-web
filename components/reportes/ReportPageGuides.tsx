"use client";

import { useEffect, useState } from "react";
import LogoCerteza from "@/components/branding/LogoCerteza";

const PAGE_HEIGHT = 1056;
const TOP_SAFE = 84;
const BOTTOM_SAFE = 72;

export default function ReportPageGuides({
  folio,
  final = false,
}: {
  folio?: string;
  final?: boolean;
}) {
  const [paginas, setPaginas] = useState(1);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-report-root]");
    if (!root) return;

    let raf = 0;

    const proteger = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const todosLosCandidatos = Array.from(
          root.querySelectorAll<HTMLElement>(
            '[data-page-unit], .report-figure, .colored-block, .page-row, tr, figure, .report-section > div > p, .report-section h1, .report-section h2, .report-section h3, .report-section h4'
          )
        );
        const candidatos = todosLosCandidatos.filter((el) => {
          if (el.closest("#sec-firmas")) return false;
          const padreProtegido = el.parentElement?.closest<HTMLElement>("[data-page-unit]");
          return !padreProtegido;
        });

        for (const el of todosLosCandidatos) el.style.marginTop = "";
        const encabezados = Array.from(root.querySelectorAll<HTMLElement>(".partida-header"));
        for (const el of encabezados) el.style.marginTop = "";
        const secciones = Array.from(root.querySelectorAll<HTMLElement>(".page-break"));
        for (const el of secciones) el.style.marginTop = "";

        const rootTop = root.getBoundingClientRect().top + window.scrollY;

        for (let pasada = 0; pasada < 5; pasada += 1) {
          let cambio = false;

          for (const seccion of secciones) {
            // El reporte debe fluir de arriba hacia abajo. Sólo los elementos
            // marcados expresamente fuerzan hoja nueva.
            if (!seccion.hasAttribute("data-force-new-page")) continue;
            const rect = seccion.getBoundingClientRect();
            const top = rect.top + window.scrollY - rootTop;
            const pagina = Math.max(0, Math.floor(top / PAGE_HEIGHT));
            const offset = top - pagina * PAGE_HEIGHT;
            const tolerancia = 6;
            if (Math.abs(offset - TOP_SAFE) <= tolerancia) continue;
            const salto = offset < TOP_SAFE
              ? TOP_SAFE - offset
              : PAGE_HEIGHT - offset + TOP_SAFE;
            seccion.style.marginTop = `${salto}px`;
            cambio = true;
          }

          for (const encabezado of encabezados) {
            const siguiente = encabezado.parentElement?.querySelector<HTMLElement>(".inspection-pair");
            if (!siguiente) continue;
            const er = encabezado.getBoundingClientRect();
            const sr = siguiente.getBoundingClientRect();
            const top = er.top + window.scrollY - rootTop;
            const altoCombinado = (sr.bottom - er.top);
            const pagina = Math.max(0, Math.floor(top / PAGE_HEIGHT));
            const offset = top - pagina * PAGE_HEIGHT;
            const finSeguro = PAGE_HEIGHT - BOTTOM_SAFE;
            if (altoCombinado <= PAGE_HEIGHT - TOP_SAFE - BOTTOM_SAFE && offset + altoCombinado > finSeguro) {
              const salto = PAGE_HEIGHT - offset + TOP_SAFE;
              encabezado.style.marginTop = `${salto}px`;
              cambio = true;
            }
          }

          for (const el of candidatos) {
            const rect = el.getBoundingClientRect();
            const alto = rect.height;
            if (alto <= 0 || alto > PAGE_HEIGHT - TOP_SAFE - BOTTOM_SAFE) continue;

            const top = rect.top + window.scrollY - rootTop;
            const pagina = Math.max(0, Math.floor(top / PAGE_HEIGHT));
            const offset = top - pagina * PAGE_HEIGHT;

            if (pagina > 0 && offset < TOP_SAFE) {
              const actual = Number.parseFloat(el.style.marginTop || "0") || 0;
              el.style.marginTop = `${actual + (TOP_SAFE - offset)}px`;
              cambio = true;
              continue;
            }

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
        const totalPaginas = Math.max(1, Math.ceil(altoTotal / PAGE_HEIGHT));
        setPaginas(totalPaginas);
      });
    };

    proteger();

    const imgs = Array.from(root.querySelectorAll("img"));
    imgs.forEach((img) => img.addEventListener("load", proteger));
    window.addEventListener("resize", proteger);
    const t1 = window.setTimeout(proteger, 250);
    const t2 = window.setTimeout(proteger, 1000);

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
        const top = index * PAGE_HEIGHT;
        const footerTop = page * PAGE_HEIGHT - 58;

        return (
          <div key={page}>
            {page > 1 && (
              <div
                className="absolute left-0 right-0 flex h-[72px] items-center justify-between bg-slate-950 px-10 text-white"
                style={{ top }}
              >
                <div className="flex items-center gap-3">
                  <LogoCerteza variant="gold" width={86} className="max-h-14" />
                  <div>
                    <p className="text-[12px] font-black uppercase tracking-[.16em] text-amber-300">Certeza Habitacional</p>
                    <p className="text-[12px] font-bold text-white">Reporte de inspección</p>
                  </div>
                </div>
                <p className="text-[12px] font-black text-white">{folio ?? ""}</p>
              </div>
            )}

            <div
              className="absolute left-0 right-0 flex h-[58px] items-center justify-between bg-slate-950 px-10 text-white"
              style={{ top: footerTop }}
            >
              <span className="text-[11px] font-black uppercase tracking-[.12em] text-amber-300">Certeza Habitacional</span>
              <span className="text-[11px] font-black text-white">Página {page} de {paginas}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
