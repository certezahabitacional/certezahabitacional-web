"use client";

import { useEffect, useRef, useState, useTransition } from "react";

type Props = {
  inspeccionId: string;
  areaId: string;
  itemId: string;
  numeroFoto: number;
  totalFotos?: number;
  subirFoto: (formData: FormData) => Promise<void>;
};

export default function CapturaConceptoArea({
  inspeccionId,
  areaId,
  itemId,
  numeroFoto,
  totalFotos = 4,
  subirFoto,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState("");
  const [captura, setCaptura] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [enviando, startTransition] = useTransition();

  const detener = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setAbierta(false);
  };

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const abrir = async () => {
    setError("");
    setCaptura(null);
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview("");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no permite acceso directo a la cámara. Usa la opción de galería.");
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
      setError("No fue posible abrir la cámara. Revisa el permiso del navegador.");
    }
  };

  const tomar = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError("La cámara todavía no está lista.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `captura-${Date.now()}.jpg`, { type: "image/jpeg" });
      setCaptura(file);
      const url = URL.createObjectURL(blob);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(url);
      detener();
    }, "image/jpeg", 0.92);
  };

  const guardar = () => {
    if (!captura) return;
    const formData = new FormData();
    formData.set("inspeccionId", inspeccionId);
    formData.set("areaId", areaId);
    formData.set("itemId", itemId);
    formData.set("archivo", captura);
    formData.set("origenEvidencia", "CAMARA");
    startTransition(async () => subirFoto(formData));
  };

  return (
    <div className="rounded-xl border border-cyan-300/30 bg-cyan-300/5 p-3">
      {!abierta && !captura && (
        <button type="button" onClick={abrir} className="w-full rounded-xl border border-dashed border-cyan-300/50 px-4 py-5 text-center font-black text-cyan-200">
          <span className="block text-3xl">📷</span>
          <span className="mt-1 block">ABRIR CÁMARA</span>
          <span className="mt-1 block text-[10px] text-slate-500">Foto {numeroFoto}/{totalFotos}</span>
        </button>
      )}
      {abierta && (
        <div>
          <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded-xl bg-black object-cover" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={tomar} className="rounded-xl bg-cyan-300 px-3 py-3 text-sm font-black text-slate-950">CAPTURAR FOTO</button>
            <button type="button" onClick={detener} className="rounded-xl border border-white/10 px-3 py-3 text-sm font-black text-slate-300">CANCELAR</button>
          </div>
        </div>
      )}
      {captura && preview && (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Vista previa" className="aspect-video w-full rounded-xl bg-black object-cover" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={guardar} disabled={enviando} className="rounded-xl bg-cyan-300 px-3 py-3 text-sm font-black text-slate-950 disabled:opacity-50">
              {enviando ? "GUARDANDO..." : "GUARDAR FOTO"}
            </button>
            <button type="button" disabled={enviando} onClick={() => { setCaptura(null); if (preview) URL.revokeObjectURL(preview); setPreview(""); void abrir(); }} className="rounded-xl border border-white/10 px-3 py-3 text-sm font-black text-slate-300">
              REPETIR
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-rose-400/10 p-3 text-xs font-bold text-rose-300">{error}</p>}
    </div>
  );
}
