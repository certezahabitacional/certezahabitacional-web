"use client";

import { useActionState } from "react";
import { iniciarSesion } from "./actions";

type Estado = {
  error?: string;
};

const estadoInicial: Estado = {};

export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [estado, accion, pendiente] = useActionState(
    async (_estadoAnterior: Estado, formData: FormData) => iniciarSesion(formData),
    estadoInicial,
  );

  const mensaje =
    estado.error === "credenciales"
      ? "Correo o contraseña incorrectos."
      : estado.error
        ? "No fue posible iniciar sesión. Intenta nuevamente."
        : "";

  return (
    <form action={accion} className="mt-8 space-y-5">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-300">Correo</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300"
          placeholder="ing.celedoniogil@gmail.com"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-300">Contraseña</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300"
          placeholder="••••••••"
        />
      </label>

      {mensaje && (
        <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {mensaje}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pendiente ? "Ingresando..." : "Iniciar sesión"}
      </button>
    </form>
  );
}
