"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveOfflineFile } from "@/lib/offline/files";
import { enqueueOfflineOperation } from "@/lib/offline/sync-queue";
import { elegirFotoNativa, esAppNativa } from "@/lib/mobile/native-media";

type Props = {
  inspeccionId: string;
  codigo: string;
  itemId: string;
  numeroFoto: number;
  totalFotos?: number;
  subirFoto: (formData: FormData) => Promise<void>;
  retorno?: "HERMETICIDAD_INICIO" | "HERMETICIDAD_CIERRE";
};

export default function CargaGaleriaConPreview({
  inspeccionId,
  codigo,
  itemId,
  numeroFoto,
  totalFotos = 1,
  subirFoto,
  retorno,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [enviando, startTransition] = useTransition();
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const seleccionar = (file: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setArchivo(file);
    setPreview(file ? URL.createObjectURL(file) : "");
  };

  const abrirGaleria = async () => {
    setError("");

    if (!esAppNativa()) {
      inputRef.current?.click();
      return;
    }

    try {
      const dataUrl = await elegirFotoNativa();
      if (!dataUrl) return;
      const respuesta = await fetch(dataUrl);
      const blob = await respuesta.blob();
      const file = new File([blob], `galeria-${Date.now()}.jpg`, {
        type: blob.type || "image/jpeg",
      });
      seleccionar(file);
    } catch {
      setError("No fue posible abrir la galería de la aplicación. Revisa los permisos e intenta nuevamente.");
    }
  };

  const guardar = () => {
    if (!archivo) return;
    setError("");
    setAviso("");
    sessionStorage.setItem("ch:puntos-criticos:foco", itemId);

    startTransition(async () => {
      try {
        if (!navigator.onLine) {
          const fileKey = crypto.randomUUID();
          await saveOfflineFile({
            key: fileKey,
            blob: archivo,
            name: archivo.name || `critico-galeria-${Date.now()}.jpg`,
            type: archivo.type || "image/jpeg",
          });
          await enqueueOfflineOperation({
            inspectionId: inspeccionId,
            operation: "PHOTO_CRITICAL_CONCEPT_V1",
            payload: {
              fileKey,
              inspectionId: inspeccionId,
              codigo,
              itemId,
              origin: "GALERIA",
            },
          });
          setAviso("Fotografía crítica guardada en este dispositivo. Se sincronizará al recuperar Internet.");
          seleccionar(null);
          return;
        }

        const formData = new FormData();
        formData.set("inspeccionId", inspeccionId);
        formData.set("codigo", codigo);
        formData.set("itemId", itemId);
        formData.set("archivo", archivo);
        formData.set("origenEvidencia", "GALERIA");
        if (retorno) formData.set("retorno", retorno);
        await subirFoto(formData);
      } catch (e) {
        if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
        setError(e instanceof Error ? e.message : "No fue posible guardar la fotografía.");
      }
    });
  };

  if (archivo && preview) {
    return (
      <div className="rounded-xl border border-violet-300/30 bg-violet-300/5 p-3">
        <div className="bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={`Vista previa de la foto ${numeroFoto}`}
            className="h-56 w-full object-contain"
          />
        </div>
        <p className="mt-2 text-center text-xs font-black text-violet-200">
          REVISA LA FOTO COMPLETA ANTES DE GUARDAR
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={guardar}
            disabled={enviando}
            className="rounded-xl bg-violet-300 px-3 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            {enviando ? "GUARDANDO..." : "CONSERVAR Y GUARDAR"}
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={() => {
              seleccionar(null);
              void abrirGaleria();
            }}
            className="rounded-xl border border-white/15 px-3 py-3 text-sm font-black text-slate-300 disabled:opacity-50"
          >
            CAMBIAR FOTO
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => seleccionar(event.target.files?.[0] ?? null)}
        />
        {aviso && <p className="mt-3 rounded-lg bg-cyan-300/10 p-3 text-xs font-bold text-cyan-100">{aviso}</p>}
        {error && <p className="mt-3 rounded-lg bg-rose-400/10 p-3 text-xs font-bold text-rose-300">{error}</p>}
      </div>
    );
  }

  return (
    <div>
    <button
      type="button"
      onClick={() => void abrirGaleria()}
      className="block w-full cursor-pointer rounded-xl border border-dashed border-violet-300/40 px-4 py-5 text-center font-black text-violet-200"
    >
      <span className="block text-2xl">🖼️</span>
      <span className="mt-1 block">ELEGIR DE GALERÍA</span>
      <span className="mt-1 block text-[10px] font-bold text-slate-500">
        Foto {numeroFoto}/{totalFotos} · se mostrará completa antes de guardar
      </span>
    </button>
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="sr-only"
      onChange={(event) => seleccionar(event.target.files?.[0] ?? null)}
    />
    {aviso && <p className="mt-3 rounded-lg bg-cyan-300/10 p-3 text-xs font-bold text-cyan-100">{aviso}</p>}
    {error && <p className="mt-3 rounded-lg bg-rose-400/10 p-3 text-xs font-bold text-rose-300">{error}</p>}
    </div>
  );
}
