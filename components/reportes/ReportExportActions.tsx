"use client";

export default function ReportExportActions({
  folio,
  pdfUrl,
}: {
  folio: string;
  pdfUrl: string;
}) {
  const imprimir = () => {
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const descargar = () => {
    const href = pdfUrl.includes("?") ? `${pdfUrl}&download=1` : `${pdfUrl}?download=1`;
    const a = document.createElement("a");
    a.href = href;
    a.download = `${folio}-reporte-oficial.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
        {folio} · ambas opciones usan únicamente el PDF oficial del reporte
      </span>
    </div>
  );
}
