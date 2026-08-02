"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function iniciarSesion(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMensaje("");
    setEnviando(true);

    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: "/acceso",
      });
    } catch (error) {
      console.error(
        "Error al iniciar sesión:",
        error,
      );

      setMensaje(
        "Correo o contraseña incorrectos.",
      );

      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
          Certeza Habitacional
        </p>

        <h1 className="mt-3 text-3xl font-black">
          Acceso al sistema
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Ingresa con tu cuenta autorizada.
        </p>

        <form
          onSubmit={iniciarSesion}
          className="mt-8 space-y-5"
        >
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">
              Correo
            </span>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
              autoComplete="email"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">
              Contraseña
            </span>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
              minLength={8}
              autoComplete="current-password"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300"
            />
          </label>

          {mensaje && (
            <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
              {mensaje}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando
              ? "Ingresando..."
              : "Iniciar sesión"}
          </button>
        </form>
      </section>
    </main>
  );
}