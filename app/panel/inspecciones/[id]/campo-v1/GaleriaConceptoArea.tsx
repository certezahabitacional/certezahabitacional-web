"use client";

import { useEffect, useRef, useState, useTransition } from "react";

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

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const seleccionar = (file: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setArchivo(file);
    setPreview(file ? URL.createObjectURL(file) : "");
  };

  const guardar = () => {
    if (!archivo) return;
    const formData = new FormData();
    formData.set("inspeccionId", inspeccionId);
    formData.set("areaId", areaId);
    formData.set("itemId", itemId);
    formData.set("archivo", archivo);
    formData.set("origenEvidencia", "GALERIA");
    startTransition(async () => subirFoto(formData));
  };

  if (archivo && preview) {
    return (
      <div className="rounded-xl border border-violet-300/30 bg-violet-300/5 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Vista previa" className="h-56 w-full bg-black object-contain" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={guardar} disabled={enviando} className="rounded-xl bg-violet-300 px-3 py-3 text-sm font-black text-slate-950 disabled:opacity-50">
            {enviando ? "GUARDANDO..." : "CONSERVAR Y GUARDAR"}
          </button>
          <button type="button" disabled={enviando} onClick={() => { seleccionar(null); inputRef.current?.click(); }} className="rounded-xl border border-white/15 px-3 py-3 text-sm font-black text-slate-300">
            CAMBIAR FOTO
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => seleccionar(e.target.files?.[0] ?? null)} />
      </div>
    );
  }

  return (
    <label className="block cursor-pointer rounded-xl border border-dashed border-violet-300/40 px-4 py-5 text-center font-black text-violet-200">
      <span className="block text-2xl">🖼️</span>
      <span className="mt-1 block">ELEGIR DE GALERÍA</span>
      <span className="mt-1 block text-[10px] text-slate-500">1 fotografía · vista previa antes de guardar</span>
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => seleccionar(e.target.files?.[0] ?? null)} />
    </label>
  );
}
