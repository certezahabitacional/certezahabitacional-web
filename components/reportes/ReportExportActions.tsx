"use client";

export default function ReportExportActions({
  folio,
  pdfUrl,
  printUrl,
}: {
  folio: string;
  pdfUrl: string;
  printUrl: string;
}) {
  const imprimir = () => {
    const ventana = window.open(printUrl, "_blank");
    if (!ventana) return;

    let impreso = false;
    const lanzarImpresion = () => {
      if (impreso || ventana.closed) return;
      impreso = true;
      try {
        ventana.focus();
        ventana.print();
      } catch {
        impreso = false;
      }
    };

    ventana.addEventListener("load", () => {
      window.setTimeout(lanzarImpresion, 900);
    }, { once: true });

    window.setTimeout(lanzarImpresion, 3500);
  };

  const descargar = () => {
    const href = pdfUrl.includes("?") ? `${pdfUrl}&download=1` : `${pdfUrl}?download=1`;
    window.location.assign(href);
  };

  return (
    <div className="no-print mx-auto mb-4 flex w-full max-w-5xl flex-wrap items-center justify-end gap-3">
      <button
        type="button"
        onClick={imprimir}
        className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
      >
        IMPRIMIR REPORTE
      </button>
      <button
        type="button"
        onClick={descargar}
        className="rounded-xl border-2 border-slate-950 px-5 py-3 text-sm font-black text-slate-950"
      >
        DESCARGAR PDF
      </button>
      <span className="text-xs font-bold text-slate-500">
        {folio} · imprimir abre la vista limpia; descargar baja el PDF oficial
      </span>
    </div>
  );
}
