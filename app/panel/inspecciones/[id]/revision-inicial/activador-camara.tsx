"use client";

import { useEffect, useRef, useState } from "react";

export function ActivadorCamaraRevision({ activo }: { activo: boolean }) {
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function inputCamara() {
    return document.querySelector<HTMLInputElement>('input[type="file"][name="archivo"][capture="environment"]');
  }

  function detenerCamara() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function abrirCamara() {
    if (!activo) return;
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      inputCamara()?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setAbierta(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("El navegador no permitió abrir la cámara. Revisa el permiso de cámara del sitio o usa Galería/archivos.");
      setAbierta(true);
    }
  }

  useEffect(() => {
    const icono = document.querySelector<HTMLElement>('[aria-label="Cámara"]');
    if (!icono) return;

    const manejarClick = (event: MouseEvent) => {
      event.preventDefault();
      if (activo) void abrirCamara();
    };
    const manejarTecla = (event: KeyboardEvent) => {
      if (!activo || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      void abrirCamara();
    };

    icono.setAttribute("role", "button");
    icono.setAttribute("tabindex", activo ? "0" : "-1");
    icono.setAttribute("aria-disabled", activo ? "false" : "true");
    icono.setAttribute("title", activo ? "Abrir cámara" : "La cámara no está disponible en este momento");
    icono.style.cursor = activo ? "pointer" : "default";
    icono.style.opacity = activo ? "1" : "0.65";
    icono.addEventListener("click", manejarClick);
    icono.addEventListener("keydown", manejarTecla);

    return () => {
      icono.removeEventListener("click", manejarClick);
      icono.removeEventListener("keydown", manejarTecla);
      detenerCamara();
    };
  }, [activo]);

  async function capturar() {
    const video = videoRef.current;
    const input = inputCamara();
    if (!video || !input || video.videoWidth <= 0 || video.videoHeight <= 0) {
      setError("La cámara todavía no está lista para capturar.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("No fue posible preparar la fotografía.");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setError("No fue posible capturar la fotografía.");
      return;
    }

    const archivo = new File([blob], `fachada-${Date.now()}.jpg`, { type: "image/jpeg" });
    const transferencia = new DataTransfer();
    transferencia.items.add(archivo);
    input.files = transferencia.files;

    detenerCamara();
    setAbierta(false);
    input.form?.requestSubmit();
  }

  function cerrar() {
    detenerCamara();
    setAbierta(false);
    setError("");
  }

  function usarSelectorDispositivo() {
    detenerCamara();
    setAbierta(false);
    inputCamara()?.click();
  }

  if (!abierta) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-cyan-300/30 bg-slate-900 p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Cámara · fachada principal</p>
            <p className="mt-1 text-sm text-slate-400">Cada toma en sitio forma parte de la serie obligatoria de 4 fotografías.</p>
          </div>
          <button type="button" onClick={cerrar} className="rounded-full border border-white/15 px-4 py-2 text-xs font-black">CERRAR</button>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
            <p className="font-bold">{error}</p>
            <button type="button" onClick={usarSelectorDispositivo} className="mt-4 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">
              ABRIR CÁMARA / SELECTOR DEL DISPOSITIVO
            </button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="mt-5 max-h-[65vh] w-full rounded-2xl bg-black object-contain" />
            <button type="button" onClick={capturar} className="mt-4 w-full rounded-2xl bg-cyan-300 px-5 py-4 text-sm font-black text-slate-950">
              📷 CAPTURAR FOTOGRAFÍA
            </button>
          </>
        )}
      </div>
    </div>
  );
}
