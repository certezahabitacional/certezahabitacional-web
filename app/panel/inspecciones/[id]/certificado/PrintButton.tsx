"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 print:hidden"
    >
      Imprimir / Guardar PDF
    </button>
  );
}
