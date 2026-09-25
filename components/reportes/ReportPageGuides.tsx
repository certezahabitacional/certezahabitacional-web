"use client";

import { useEffect, useState } from "react";
import LogoCerteza from "@/components/branding/LogoCerteza";

const PAGE_HEIGHT = 1056;
const HEADER_HEIGHT = 48;
const FOOTER_HEIGHT = 32;
const TOP_SAFE = 56;
const BOTTOM_SAFE = 40;
const REPEAT_HEADER_HEIGHT = 36;

type RepeatHeader = {
  pagina: number;
  columnas: string;
  etiquetas: string[];
};

export default function ReportPageGuides({
  folio,
  final = false,
  footerCode = "CH-R-001",
  footerEmail = "contacto@certezahabitacional.com",
  footerPhone = "656 287 12 18",
  footerAddress = "Monte Apeninos 6436, Col. La Cuesta, Ciudad Juárez, Chihuahua",
}: {
  folio?: string;
  final?: boolean;
  footerCode?: string;
  footerEmail?: string;
  footerPhone?: string;
  footerAddress?: string;
}) {
  const [paginas, setPaginas] = useState(1);
  const [encabezadosRepetidos, setEncabezadosRepetidos] = useState<RepeatHeader[]>([]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-report-root]");
    if (!root) return;

    let raf = 0;

    const proteger = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rootTop = root.getBoundingClientRect().top + window.scrollY;

        const nodos = Array.from(
          root.querySelectorAll<HTMLElement>(
            [
              "[data-force-new-page]",
              "[data-page-unit]",
              ".inspection-pair",
              ".report-figure",
              ".colored-block",
              ".page-row",
              ".metric-card",
              ".summary-card",
              "[data-repeat-header] > :not([data-table-header])",
              ".section-content > p",
              ".section-content > .grid",
              "tr",
              "figure",
            ].join(",")
          )
        );

        for (const nodo of nodos) nodo.style.marginTop = "";
        for (const encabezado of root.querySelectorAll<HTMLElement>(".partida-header")) {
          encabezado.style.marginTop = "";
        }

        const esAtomicoAnidado = (el: HTMLElement) => {
          const padre = el.parentElement?.closest<HTMLElement>(
            '[data-page-unit], .inspection-pair, .report-figure, .colored-block, .page-row, .metric-card, .summary-card, figure'
          );
          return Boolean(padre && padre !== el);
        };

        // Una sola pasada en orden DOM. Cada ajuste anterior ya está incorporado
        // cuando se mide el siguiente elemento, evitando márgenes acumulativos.
        for (const nodo of nodos) {
          if (nodo.matches("thead tr")) continue;
          if (nodo.closest("#sec-firmas") && !nodo.matches("[data-force-new-page]")) continue;

          const forzarPagina = nodo.hasAttribute("data-force-new-page");
          if (!forzarPagina && esAtomicoAnidado(nodo)) continue;

          const rect = nodo.getBoundingClientRect();
          const alto = rect.height;
          if (alto <= 0) continue;

          const top = rect.top + window.scrollY - rootTop;
          const pagina = Math.max(0, Math.floor(top / PAGE_HEIGHT));
          const offset = top - pagina * PAGE_HEIGHT;

          if (forzarPagina) {
            if (Math.abs(offset - TOP_SAFE) <= 3) continue;
            const salto = offset < TOP_SAFE
              ? TOP_SAFE - offset
              : PAGE_HEIGHT - offset + TOP_SAFE;
            nodo.style.marginTop = `${Math.max(0, salto)}px`;
            continue;
          }

          const tabla = nodo.closest<HTMLElement>("[data-repeat-header]");
          let inicioSeguro = pagina > 0 ? TOP_SAFE : 0;
          if (tabla) {
            const tablaRect = tabla.getBoundingClientRect();
            const inicioTabla = tablaRect.top + window.scrollY - rootTop;
            const paginaInicioTabla = Math.max(0, Math.floor(inicioTabla / PAGE_HEIGHT));
            if (pagina > paginaInicioTabla) inicioSeguro += REPEAT_HEADER_HEIGHT;
          }

          const altoUtil = PAGE_HEIGHT - inicioSeguro - BOTTOM_SAFE;
          if (alto > altoUtil) continue;

          if (pagina > 0 && offset < inicioSeguro) {
            nodo.style.marginTop = `${inicioSeguro - offset}px`;
            continue;
          }

          const finSeguro = PAGE_HEIGHT - BOTTOM_SAFE;
          if (offset + alto > finSeguro) {
            nodo.style.marginTop = `${PAGE_HEIGHT - offset + inicioSeguro}px`;
          }
        }

        const tablasRepetibles = Array.from(
          root.querySelectorAll<HTMLElement>("[data-repeat-header]")
        );
        const repetidos: RepeatHeader[] = [];

        for (const tabla of tablasRepetibles) {
          const rect = tabla.getBoundingClientRect();
          const top = rect.top + window.scrollY - rootTop;
          const bottom = rect.bottom + window.scrollY - rootTop;
          const paginaInicio = Math.max(0, Math.floor(top / PAGE_HEIGHT));
          const paginaFin = Math.max(paginaInicio, Math.floor((bottom - 1) / PAGE_HEIGHT));
          const etiquetas = String(tabla.dataset.repeatHeader ?? "").split("|").filter(Boolean);
          const columnas = String(tabla.dataset.repeatCols ?? "1fr 1fr");

          for (let pagina = paginaInicio + 1; pagina <= paginaFin; pagina += 1) {
            repetidos.push({ pagina, columnas, etiquetas });
          }
        }

        const altoTotal = Math.max(root.scrollHeight, root.getBoundingClientRect().height);
        const totalPaginas = Math.max(1, Math.ceil(altoTotal / PAGE_HEIGHT));
        setPaginas(totalPaginas);
        setEncabezadosRepetidos(repetidos.filter((item) => item.pagina < totalPaginas - 1));
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
    <div className="pointer-events-none absolute inset-0 z-50 print:hidden" aria-hidden="true">
      {Array.from({ length: paginas }, (_, index) => {
        const page = index + 1;
        const top = index * PAGE_HEIGHT;
        const footerTop = page * PAGE_HEIGHT - FOOTER_HEIGHT;

        const esCertificado = page === paginas;

        return (
          <div key={page}>
            {!esCertificado && page > 1 && (
              <div
                className="absolute left-0 right-0 flex items-center justify-between bg-slate-950 px-10 text-white"
                style={{ top, height: HEADER_HEIGHT }}
              >
                <div className="flex items-center gap-3">
                  <LogoCerteza variant="gold" width={60} className="max-h-10" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.14em] text-amber-300">
                      Certeza Habitacional
                    </p>
                    <p className="text-[10px] font-bold text-white">Reporte de inspección</p>
                  </div>
                </div>
                <p className="text-[10px] font-black text-white">{folio ?? ""}</p>
              </div>
            )}

            {!esCertificado && encabezadosRepetidos
              .filter((item) => item.pagina === index)
              .map((item, repeatIndex) => (
                <div
                  key={`repeat-${page}-${repeatIndex}`}
                  className="absolute left-10 right-10 grid items-center rounded-t-xl bg-amber-400 px-4 py-2 text-xs font-black text-slate-950"
                  style={{
                    top: top + HEADER_HEIGHT,
                    minHeight: REPEAT_HEADER_HEIGHT,
                    gridTemplateColumns: item.columnas,
                  }}
                >
                  {item.etiquetas.map((etiqueta) => (
                    <span key={etiqueta}>{etiqueta}</span>
                  ))}
                </div>
              ))}

            {!esCertificado && (
              <div
                className="absolute left-0 right-0 grid grid-cols-[auto_1fr_auto] items-center gap-4 border-t border-amber-400/70 bg-slate-950 px-5 text-white"
                style={{ top: footerTop, height: FOOTER_HEIGHT }}
              >
                <span className="text-[8px] font-black uppercase tracking-[.08em] text-slate-200">
                  {footerCode}
                </span>
                <span className="truncate text-center text-[8px] font-medium text-slate-200">
                  {footerEmail} &nbsp; | &nbsp; {footerPhone} &nbsp; | &nbsp; {footerAddress}
                </span>
                <span className="text-[8px] font-black text-slate-200">
                  Pág. {page} / {paginas}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
