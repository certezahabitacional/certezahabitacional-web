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
  const [encabezadosRepetidos, setEncabezadosRepetidos] = useState<Array<{
    pagina: number;
    columnas: string;
    etiquetas: string[];
  }>>([]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-report-root]");
    if (!root) return;

    let raf = 0;

    const proteger = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const todosLosCandidatos = Array.from(
          root.querySelectorAll<HTMLElement>(
            '[data-page-unit], .inspection-pair, .report-figure, .colored-block, .page-row, tr, figure'
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
        const secciones = Array.from(root.querySelectorAll<HTMLElement>("[data-force-new-page]"));
        for (const el of secciones) el.style.marginTop = "";

        const rootTop = root.getBoundingClientRect().top + window.scrollY;
        const tablasRepetibles = Array.from(root.querySelectorAll<HTMLElement>("[data-repeat-header]"));
        for (const tabla of tablasRepetibles) {
          const cabecera = tabla.firstElementChild as HTMLElement | null;
          const primeraFila = cabecera?.nextElementSibling as HTMLElement | null;
          if (!cabecera || !primeraFila) continue;
          cabecera.style.marginTop = "";
          const cr = cabecera.getBoundingClientRect();
          const fr = primeraFila.getBoundingClientRect();
          const top = cr.top + window.scrollY - rootTop;
          const pagina = Math.max(0, Math.floor(top / PAGE_HEIGHT));
          const offset = top - pagina * PAGE_HEIGHT;
          const altoCombinado = fr.bottom - cr.top;
          const finSeguro = PAGE_HEIGHT - BOTTOM_SAFE;
          if (offset + altoCombinado > finSeguro) {
            cabecera.style.marginTop = `${PAGE_HEIGHT - offset + TOP_SAFE}px`;
          }
        }

        for (let pasada = 0; pasada < 1; pasada += 1) {
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
            const altoEncabezadoYPrimeraFila = sr.bottom - er.top;
            const pagina = Math.max(0, Math.floor(top / PAGE_HEIGHT));
            const offset = top - pagina * PAGE_HEIGHT;
            const disponible = PAGE_HEIGHT - BOTTOM_SAFE - offset;
            const cabeEnPaginaNueva = altoEncabezadoYPrimeraFila <= PAGE_HEIGHT - TOP_SAFE - BOTTOM_SAFE;
            if (cabeEnPaginaNueva && altoEncabezadoYPrimeraFila > disponible) {
              encabezado.style.marginTop = `${PAGE_HEIGHT - offset + TOP_SAFE}px`;
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
            const tablaRepetible = el.closest<HTMLElement>("[data-repeat-header]");
            let topSeguro = TOP_SAFE;
            if (tablaRepetible) {
              const tr = tablaRepetible.getBoundingClientRect();
              const inicioTabla = tr.top + window.scrollY - rootTop;
              const paginaInicioTabla = Math.max(0, Math.floor(inicioTabla / PAGE_HEIGHT));
              if (pagina > paginaInicioTabla) topSeguro = TOP_SAFE + 44;
            }

            if (pagina > 0 && offset < topSeguro) {
              const actual = Number.parseFloat(el.style.marginTop || "0") || 0;
              el.style.marginTop = `${actual + (topSeguro - offset)}px`;
              cambio = true;
              continue;
            }

            const finSeguro = PAGE_HEIGHT - BOTTOM_SAFE;
            if (offset + alto > finSeguro) {
              const actual = Number.parseFloat(el.style.marginTop || "0") || 0;
              const salto = PAGE_HEIGHT - offset + topSeguro;
              el.style.marginTop = `${actual + salto}px`;
              cambio = true;
            }
          }

          // Los ajustes atómicos anteriores pueden desplazar hacia abajo temas posteriores.
          // Re-alineamos cada tema principal al área útil superior de su página,
          // en orden DOM, para que ninguno quede a media hoja.
          for (const seccion of secciones) {
            const rect = seccion.getBoundingClientRect();
            const top = rect.top + window.scrollY - rootTop;
            const pagina = Math.max(0, Math.floor(top / PAGE_HEIGHT));
            const offset = top - pagina * PAGE_HEIGHT;
            const objetivo = TOP_SAFE;
            if (Math.abs(offset - objetivo) <= 3) continue;

            const actual = Number.parseFloat(seccion.style.marginTop || "0") || 0;
            if (offset < objetivo) {
              seccion.style.marginTop = `${Math.max(0, actual + (objetivo - offset))}px`;
            } else {
              seccion.style.marginTop = `${Math.max(0, actual + (PAGE_HEIGHT - offset + objetivo))}px`;
            }
          }

          if (!cambio) break;
        }

        const repetidos: Array<{ pagina: number; columnas: string; etiquetas: string[] }> = [];
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
        setEncabezadosRepetidos(repetidos);
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
        const footerTop = page * PAGE_HEIGHT - 64;

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

            {encabezadosRepetidos
              .filter((item) => item.pagina === index)
              .map((item, repeatIndex) => (
                <div
                  key={`repeat-${page}-${repeatIndex}`}
                  className="absolute left-10 right-10 grid min-h-[40px] items-center rounded-t-xl bg-amber-400 px-4 py-2 text-xs font-black text-slate-950"
                  style={{ top: top + 72, gridTemplateColumns: item.columnas }}
                >
                  {item.etiquetas.map((etiqueta) => <span key={etiqueta}>{etiqueta}</span>)}
                </div>
              ))}

            <div
              className="absolute left-0 right-0 flex h-[64px] items-center justify-between bg-slate-950 px-10 text-white"
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
