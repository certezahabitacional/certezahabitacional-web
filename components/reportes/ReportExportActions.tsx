"use client";

export default function ReportExportActions({ folio }: { folio: string }) {
  const imprimir = () => window.print();

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
        onClick={imprimir}
        className="rounded-xl border-2 border-slate-950 px-5 py-3 text-sm font-black text-slate-950"
        title="En el cuadro de impresión selecciona Guardar como PDF"
      >
        DESCARGAR / GUARDAR PDF
      </button>
      <span className="text-xs font-bold text-slate-500">
        {folio} · usa “Guardar como PDF” en el cuadro de impresión
      </span>
    </div>
  );
}
