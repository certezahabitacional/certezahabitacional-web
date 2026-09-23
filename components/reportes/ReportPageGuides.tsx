"use client";

import { useEffect, useState } from "react";
import LogoCerteza from "@/components/branding/LogoCerteza";

const PAGE_HEIGHT = 1056;
const TOP_SAFE = 84;
const BOTTOM_SAFE = 92;

export default function ReportPageGuides({
  folio,
  final = false,
}: {
  folio?: string;
  final?: boolean;
}) {
  const [paginas, setPaginas] = useState(1);
  const [paginasConEncabezadoPropio, setPaginasConEncabezadoPropio] = useState<number[]>([]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-report-root]");
    if (!root) return;

    let raf = 0;

    const proteger = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const todosLosCandidatos = Array.from(
          root.querySelectorAll<HTMLElement>(
            '[data-page-unit], .report-figure, .colored-block, .page-row, tr, figure, .signature-pair, .report-section > div > p, .report-section h1, .report-section h2, .report-section h3, .report-section h4'
          )
        );
        const candidatos = todosLosCandidatos.filter((el) => {
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
            const rect = seccion.getBoundingClientRect();
            const top = rect.top + window.scrollY - rootTop;
            const pagina = Math.max(0, Math.floor(top / PAGE_HEIGHT));
            const offset = top - pagina * PAGE_HEIGHT;
            const objetivo = pagina === 0 ? 0 : TOP_SAFE;
            const tolerancia = 6;

            if (pagina === 0 && top < PAGE_HEIGHT - tolerancia) continue;
            // Cada tema principal del índice debe iniciar en una hoja nueva.
            // Si ya está exactamente al inicio seguro de una página, no agregamos espacio.
            if (Math.abs(offset - objetivo) <= tolerancia) continue;

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
        const propios = Array.from(root.querySelectorAll<HTMLElement>(".report-brand-header"))
          .map((el) => {
            const top = el.getBoundingClientRect().top + window.scrollY - rootTop;
            return Math.max(0, Math.floor(top / PAGE_HEIGHT)) + 1;
          });
        setPaginas(totalPaginas);
        setPaginasConEncabezadoPropio(Array.from(new Set(propios)));
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
        const footerTop = page * PAGE_HEIGHT - 54;

        return (
          <div key={page}>
            {page > 1 && !paginasConEncabezadoPropio.includes(page) && (
              <div
                className="absolute left-10 right-10 flex h-[54px] items-center justify-between border-b border-amber-500/40 bg-white/95 px-2"
                style={{ top: top + 10 }}
              >
                <div className="flex items-center gap-3">
                  <LogoCerteza variant="gold" width={58} className="max-h-10" />
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[.18em] text-amber-700">Certeza Habitacional</p>
                    <p className="text-[9px] font-bold text-slate-500">{final ? "Reporte liberado de inspección" : "Pre reporte de inspección"}</p>
                  </div>
                </div>
                <p className="text-[9px] font-black text-slate-600">{folio ?? ""}</p>
              </div>
            )}

            <div
              className="absolute left-10 right-10 flex items-center justify-between border-t border-amber-500/40 bg-white/95 px-2 pt-2"
              style={{ top: footerTop }}
            >
              <span className="text-[9px] font-black uppercase tracking-[.14em] text-slate-500">Certeza Habitacional</span>
              <span className="text-[10px] font-black text-slate-600">Página {page} de {paginas}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
