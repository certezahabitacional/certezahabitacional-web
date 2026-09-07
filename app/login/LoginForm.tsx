"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

type RespuestaSignIn = {
  error?: string | null;
  code?: string | null;
  ok?: boolean;
  status?: number;
  url?: string | null;
};

export default function LoginForm() {
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"error" | "bloqueo">("error");
  const [enviando, setEnviando] = useState(false);

  async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setTipoMensaje("error");
      setMensaje("Ingresa tu correo y contraseña.");
      return;
    }

    setMensaje("");
    setEnviando(true);

    try {
      const respuesta = (await signIn("credentials", {
        email,
        password,
        redirect: false,
        redirectTo: "/acceso",
      })) as RespuestaSignIn | undefined;

      if (respuesta?.error) {
        if (respuesta.code === "cuenta_bloqueada") {
          setTipoMensaje("bloqueo");
          setMensaje(
            "Cuenta temporalmente bloqueada por seguridad. El bloqueo dura 15 minutos desde el quinto intento fallido.",
          );
        } else {
          setTipoMensaje("error");
          setMensaje("Correo o contraseña incorrectos.");
        }
        setEnviando(false);
        return;
      }

      window.location.assign("/acceso");
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      setTipoMensaje("error");
      setMensaje("No fue posible iniciar sesión. Intenta nuevamente.");
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-136px)] items-center justify-center bg-[#020B14] px-6 py-10 text-white">
      <section className="w-full max-w-md rounded-3xl border border-[#D79A21]/30 bg-[#071522] p-8 shadow-2xl shadow-black/40">
        <div className="mb-6 flex justify-center">
          <Image
            src="/branding/logo-autorizado.png"
            alt="Certeza Habitacional"
            width={260}
            height={210}
            priority
            style={{ width: "190px", height: "auto" }}
          />
        </div>

        <p className="text-center text-xs font-black uppercase tracking-[0.22em] text-[#efc55f]">
          Plataforma autorizada
        </p>

        <h1 className="mt-3 text-center text-3xl font-black">
          Acceso al sistema
        </h1>

        <p className="mt-2 text-center text-sm text-slate-400">
          Ingresa con tu cuenta autorizada.
        </p>

        <form onSubmit={iniciarSesion} method="post" action="/login" className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-300">Correo</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              disabled={enviando}
              className="w-full rounded-2xl border border-white/10 bg-[#030B16] px-4 py-3 text-base outline-none transition focus:border-[#D79A21] disabled:opacity-70"
            />
          </label>

          <div>
            <span className="mb-2 block text-sm font-bold text-slate-300">
              Contraseña
            </span>

            <div className="relative">
              <input
                name="password"
                type={mostrarPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={enviando}
                className="w-full rounded-2xl border border-white/10 bg-[#030B16] px-4 py-3 pr-24 text-base outline-none transition focus:border-[#D79A21] disabled:opacity-70"
              />

              <button
                type="button"
                onClick={() => setMostrarPassword((valor) => !valor)}
                aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={mostrarPassword}
                disabled={enviando}
                className="absolute inset-y-0 right-3 my-auto h-fit rounded-full border border-[#D79A21]/35 bg-[#D79A21]/5 px-3 py-1.5 text-xs font-black text-[#efc55f] transition hover:border-[#D79A21] disabled:opacity-60"
              >
                {mostrarPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          {mensaje && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                tipoMensaje === "bloqueo"
                  ? "border-amber-300/20 bg-amber-300/10 text-amber-200"
                  : "border-rose-400/20 bg-rose-400/10 text-rose-200"
              }`}
            >
              {tipoMensaje === "bloqueo" && (
                <p className="mb-1 font-black">Acceso temporalmente bloqueado</p>
              )}
              <p>{mensaje}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-xl bg-gradient-to-r from-[#a76c13] via-[#D79A21] to-[#efc55f] px-5 py-3 font-black text-[#020B14] shadow-lg shadow-[#D79A21]/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? "Verificando..." : "Iniciar sesión"}
          </button>
        </form>
      </section>
    </main>
  );
}
