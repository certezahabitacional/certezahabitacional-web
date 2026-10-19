"use client";

import { useRef, useState } from "react";
import { elegirFotoNativa, esAppNativa } from "@/lib/mobile/native-media";

type Props = {
  inspeccionId: string;
  action: (formData: FormData) => Promise<void>;
};

export default function SelectorFachadaExistente({ inspeccionId, action }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");

  async function elegir() {
    setError("");

    if (!esAppNativa()) {
      inputRef.current?.click();
      return;
    }

    try {
      const dataUrl = await elegirFotoNativa();
      const input = inputRef.current;
      if (!dataUrl || !input) return;

      const respuesta = await fetch(dataUrl);
      const blob = await respuesta.blob();
      const archivo = new File([blob], `fachada-existente-${Date.now()}.jpg`, {
        type: blob.type || "image/jpeg",
      });
      const transferencia = new DataTransfer();
      transferencia.items.add(archivo);
      input.files = transferencia.files;
      setNombre(archivo.name);
    } catch {
      setError("No fue posible abrir la galería de la aplicación. Revisa los permisos e intenta nuevamente.");
    }
  }

  return (
    <form action={action} className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
      <input type="hidden" name="inspeccionId" value={inspeccionId} />
      <label className="block text-sm font-black text-cyan-200">Galería o archivos del dispositivo</label>
      <button
        type="button"
        onClick={() => void elegir()}
        className="mt-3 w-full rounded-xl border border-dashed border-cyan-300/40 px-4 py-3 text-left text-xs font-black text-cyan-200"
      >
        🖼️ {esAppNativa() ? "ABRIR GALERÍA DE LA APP" : "ELEGIR FOTO DEL DISPOSITIVO"}
      </button>
      <input
        ref={inputRef}
        name="archivo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required
        className="sr-only"
        onChange={(event) => setNombre(event.target.files?.[0]?.name ?? "")}
      />
      {nombre && <p className="mt-2 text-xs font-bold text-emerald-300">✓ Fotografía lista: {nombre}</p>}
      {error && <p className="mt-2 text-xs font-bold text-rose-300">{error}</p>}
      <button className="mt-3 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950">
        USAR ESTA FOTO COMO DEFINITIVA
      </button>
    </form>
  );
}
