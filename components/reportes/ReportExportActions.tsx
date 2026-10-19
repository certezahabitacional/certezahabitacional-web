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
  const hrefPdf = pdfUrl.includes("?") ? `${pdfUrl}&download=1` : `${pdfUrl}?download=1`;

  return (
    <div className="no-print mx-auto mb-4 flex w-full max-w-5xl flex-wrap items-center justify-end gap-3">
      <a
        href={printUrl}
        className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
      >
        IMPRIMIR REPORTE
      </a>
      <a
        href={hrefPdf}
        className="rounded-xl border-2 border-slate-950 px-5 py-3 text-sm font-black text-slate-950"
      >
        DESCARGAR PDF
      </a>
      <span className="text-xs font-bold text-slate-500">
        {folio} · acciones directas, sin scripts intermedios
      </span>
    </div>
  );
}
