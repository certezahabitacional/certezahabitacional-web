"use client";

import { useFormStatus } from "react-dom";

export default function BotonGenerarIa() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl border border-violet-300/30 px-4 py-3 text-sm font-black text-violet-200 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "✨ ANALIZANDO CON IA..." : "✨ GENERAR DESCRIPCIÓN CON IA"}
    </button>
  );
}
