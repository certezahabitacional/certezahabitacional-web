"use client";

import { useEffect, useRef, useState, useTransition } from "react";

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

  const guardar = () => {
    if (!archivo) return;
    const formData = new FormData();
    formData.set("inspeccionId", inspeccionId);
    formData.set("codigo", codigo);
    formData.set("itemId", itemId);
    formData.set("archivo", archivo);
    formData.set("origenEvidencia", "GALERIA");
    if (retorno) formData.set("retorno", retorno);

    sessionStorage.setItem("ch:puntos-criticos:foco", itemId);

    startTransition(async () => {
      await subirFoto(formData);
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
              inputRef.current?.click();
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
      </div>
    );
  }

  return (
    <label className="block cursor-pointer rounded-xl border border-dashed border-violet-300/40 px-4 py-5 text-center font-black text-violet-200">
      <span className="block text-2xl">🖼️</span>
      <span className="mt-1 block">ELEGIR DE GALERÍA</span>
      <span className="mt-1 block text-[10px] font-bold text-slate-500">
        Foto {numeroFoto}/{totalFotos} · se mostrará completa antes de guardar
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => seleccionar(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}
