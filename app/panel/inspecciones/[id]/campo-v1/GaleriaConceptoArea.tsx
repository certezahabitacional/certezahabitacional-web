"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { normalizarImagenCliente } from "./normalizarImagenCliente";
import { saveOfflineFile } from "@/lib/offline/files";
import { enqueueOfflineOperation } from "@/lib/offline/sync-queue";
import { elegirFotoNativa, esAppNativa } from "@/lib/mobile/native-media";

type Props = {
  inspeccionId: string;
  areaId: string;
  itemId: string;
  subirFoto: (formData: FormData) => Promise<void>;
};

export default function GaleriaConceptoArea({ inspeccionId, areaId, itemId, subirFoto }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [enviando, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const seleccionar = (file: File | null) => {
    setError("");
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
    startTransition(async () => {
      try {
        const normalizado = await normalizarImagenCliente(archivo, { maxDimension: 1920, maxBytes: 2_200_000 });
        if (!navigator.onLine) {
          const fileKey = crypto.randomUUID();
          await saveOfflineFile({
            key: fileKey,
            blob: normalizado,
            name: normalizado.name || `galeria-${Date.now()}.jpg`,
            type: normalizado.type || "image/jpeg",
          });
          await enqueueOfflineOperation({
            inspectionId: inspeccionId,
            operation: "PHOTO_CONCEPT_V1",
            payload: {
              fileKey,
              inspectionId: inspeccionId,
              areaId,
              itemId,
              origin: "GALERIA",
            },
          });
          setAviso("Fotografía guardada en este dispositivo. Se sincronizará automáticamente al recuperar Internet.");
          seleccionar(null);
          return;
        }

        const formData = new FormData();
        formData.set("inspeccionId", inspeccionId);
        formData.set("areaId", areaId);
        formData.set("itemId", itemId);
        formData.set("archivo", normalizado);
        formData.set("origenEvidencia", "GALERIA");
        await subirFoto(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No fue posible preparar la fotografía para cargarla.");
      }
    });
  };

  if (archivo && preview) {
    return (
      <div className="rounded-xl border border-violet-300/30 bg-violet-300/5 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Vista previa" className="h-56 w-full bg-black object-contain" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={guardar} disabled={enviando} className="rounded-xl bg-violet-300 px-3 py-3 text-sm font-black text-slate-950 disabled:opacity-50">
            {enviando ? "COMPRIMIENDO / GUARDANDO..." : "CONSERVAR Y GUARDAR"}
          </button>
          <button type="button" disabled={enviando} onClick={() => { seleccionar(null); void abrirGaleria(); }} className="rounded-xl border border-white/15 px-3 py-3 text-sm font-black text-slate-300">
            CAMBIAR FOTO
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => seleccionar(e.target.files?.[0] ?? null)} />
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
      <span className="mt-1 block text-[10px] text-slate-500">
        Agregar 1 fotografía · máximo 4 por concepto · {esAppNativa() ? "galería de la APP" : "galería del dispositivo"}
      </span>
    </button>
    <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => seleccionar(e.target.files?.[0] ?? null)} />
    {aviso && <p className="mt-3 rounded-lg bg-cyan-300/10 p-3 text-xs font-bold text-cyan-100">{aviso}</p>}
    {error && <p className="mt-3 rounded-lg bg-rose-400/10 p-3 text-xs font-bold text-rose-300">{error}</p>}
    </div>
  );
}
