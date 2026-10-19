"use client";

import { useRef, useState } from "react";
import { capturarFotoNativa, elegirFotoNativa, esAppNativa } from "@/lib/mobile/native-media";

export default function EvidenciaSelector() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivoNombre, setArchivoNombre] = useState("");

  async function cargarDataUrlEnInput(dataUrl: string, nombre: string) {
    const input = inputRef.current;
    if (!input) return;

    const respuesta = await fetch(dataUrl);
    const blob = await respuesta.blob();
    const archivo = new File([blob], nombre, { type: blob.type || "image/jpeg" });
    const transferencia = new DataTransfer();
    transferencia.items.add(archivo);
    input.files = transferencia.files;
    setArchivoNombre(archivo.name);
  }

  async function abrirCamara() {
    if (esAppNativa()) {
      const dataUrl = await capturarFotoNativa();
      if (dataUrl) {
        await cargarDataUrlEnInput(dataUrl, `evidencia-${Date.now()}.jpg`);
      }
      return;
    }
    const input = inputRef.current;

    if (!input) {
      return;
    }

    input.value = "";
    input.setAttribute("accept", "image/*");
    input.setAttribute("capture", "environment");
    input.click();
  }

  async function abrirGaleria() {
    if (esAppNativa()) {
      const dataUrl = await elegirFotoNativa();
      if (dataUrl) {
        await cargarDataUrlEnInput(dataUrl, `evidencia-galeria-${Date.now()}.jpg`);
      }
      return;
    }
    const input = inputRef.current;

    if (!input) {
      return;
    }

    input.value = "";
    input.setAttribute(
      "accept",
      "image/jpeg,image/png,image/webp",
    );
    input.removeAttribute("capture");
    input.click();
  }

  return (
    <div>
      <span className="mb-3 block text-sm font-bold">
        Obtener fotografía *
      </span>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void abrirCamara()}
          className="rounded-2xl border border-cyan-400 bg-cyan-400/10 px-5 py-4 text-left transition hover:bg-cyan-400/15"
        >
          <span className="block text-lg font-black">
            📷 Tomar fotografía
          </span>

          <span className="mt-1 block text-sm text-slate-400">
            Abre la cámara del dispositivo para tomar la evidencia.
          </span>
        </button>

        <button
          type="button"
          onClick={() => void abrirGaleria()}
          className="rounded-2xl border border-white/10 bg-slate-950 px-5 py-4 text-left transition hover:border-cyan-300/40"
        >
          <span className="block text-lg font-black">
            🖼️ Elegir de galería
          </span>

          <span className="mt-1 block text-sm text-slate-400">
            Selecciona una fotografía ya existente.
          </span>
        </button>
      </div>

      <input
        ref={inputRef}
        name="archivo"
        type="file"
        accept="image/*"
        required
        className="sr-only"
        onChange={(event) => {
          const archivo = event.target.files?.[0];
          setArchivoNombre(archivo?.name ?? "");
        }}
      />

      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3">
        {archivoNombre ? (
          <p className="text-sm font-bold text-emerald-300">
            ✓ Fotografía lista: {archivoNombre}
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            Todavía no se ha seleccionado ni tomado una fotografía.
          </p>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {esAppNativa()
          ? "En la APP se utiliza la cámara o galería nativas del dispositivo."
          : "En navegador, “Tomar fotografía” solicita la cámara trasera; el comportamiento puede variar según el navegador."}
      </p>
    </div>
  );
}