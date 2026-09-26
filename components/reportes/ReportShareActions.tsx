"use client";

import { useState } from "react";

export default function ReportShareActions({
  pdfUrl,
  folio,
}: {
  pdfUrl: string;
  folio: string;
}) {
  const [estado, setEstado] = useState<string>("");

  const descargar = () => {
    const enlace = document.createElement("a");
    enlace.href = pdfUrl.includes("?") ? `${pdfUrl}&download=1` : `${pdfUrl}?download=1`;
    enlace.download = `${folio}-reporte.pdf`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  };

  const compartirArchivo = async () => {
    setEstado("");
    try {
      const respuesta = await fetch(pdfUrl, { credentials: "include" });
      if (!respuesta.ok) throw new Error("No se pudo obtener el PDF.");
      const blob = await respuesta.blob();
      const archivo = new File([blob], `${folio}-reporte.pdf`, { type: "application/pdf" });

      if (navigator.canShare?.({ files: [archivo] }) && navigator.share) {
        await navigator.share({
          title: `Reporte Certeza Habitacional · ${folio}`,
          text: "Reporte de inspección Certeza Habitacional.",
          files: [archivo],
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: `Reporte Certeza Habitacional · ${folio}`,
          text: "Reporte de inspección Certeza Habitacional.",
          url: window.location.origin + pdfUrl,
        });
        return;
      }

      setEstado("Este navegador no permite compartir archivos directamente. Puedes descargar el PDF y enviarlo desde WhatsApp, correo o la app de archivos.");
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      setEstado("No fue posible abrir el menú para compartir. Puedes descargar el PDF y enviarlo manualmente.");
    }
  };

  const compartirWhatsApp = () => {
    const url = encodeURIComponent(window.location.origin + pdfUrl);
    const texto = encodeURIComponent(`Reporte de inspección Certeza Habitacional · ${folio}\n${window.location.origin + pdfUrl}`);
    window.open(`https://wa.me/?text=${texto}`, "_blank", "noopener,noreferrer");
  };

  const compartirCorreo = () => {
    const asunto = encodeURIComponent(`Reporte Certeza Habitacional · ${folio}`);
    const cuerpo = encodeURIComponent(`Adjunto/comparto el reporte de inspección Certeza Habitacional.\n\nPuedes consultarlo aquí:\n${window.location.origin + pdfUrl}`);
    window.location.href = `mailto:?subject=${asunto}&body=${cuerpo}`;
  };

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={compartirArchivo}
        className="rounded-xl bg-cyan-300 px-4 py-3 text-center text-sm font-black text-slate-950"
      >
        COMPARTIR PDF
      </button>
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={compartirWhatsApp}
          className="rounded-xl border border-emerald-300/30 px-4 py-3 text-sm font-black text-emerald-300"
        >
          WHATSAPP
        </button>
        <button
          type="button"
          onClick={compartirCorreo}
          className="rounded-xl border border-sky-300/30 px-4 py-3 text-sm font-black text-sky-300"
        >
          CORREO
        </button>
        <button
          type="button"
          onClick={descargar}
          className="rounded-xl border border-cyan-300/30 px-4 py-3 text-sm font-black text-cyan-300"
        >
          GUARDAR EN DISPOSITIVO
        </button>
      </div>
      {estado && <p className="text-xs leading-5 text-amber-300">{estado}</p>}
    </div>
  );
}
