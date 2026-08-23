"use client";

import {
  FormEvent,
  useState,
} from "react";
import { signIn } from "next-auth/react";
import LogoCerteza from "@/components/branding/LogoCerteza";

type RespuestaSignIn = {
  error?: string | null;
  code?: string | null;
  ok?: boolean;
  status?: number;
  url?: string | null;
};

export default function LoginForm() {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    mostrarPassword,
    setMostrarPassword,
  ] = useState(false);

  const [mensaje, setMensaje] =
    useState("");

  const [tipoMensaje, setTipoMensaje] =
    useState<"error" | "bloqueo">(
      "error",
    );

  const [enviando, setEnviando] =
    useState(false);

  async function iniciarSesion(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMensaje("");
    setEnviando(true);

    try {
      const respuesta =
        (await signIn(
          "credentials",
          {
            email,
            password,
            redirect: false,
            redirectTo: "/acceso",
          },
        )) as RespuestaSignIn | undefined;

      if (respuesta?.error) {
        if (
          respuesta.code ===
          "cuenta_bloqueada"
        ) {
          setTipoMensaje("bloqueo");
          setMensaje(
            "Cuenta temporalmente bloqueada por seguridad. El bloqueo dura 15 minutos desde el quinto intento fallido.",
          );
        } else {
          setTipoMensaje("error");
          setMensaje(
            "Correo o contraseña incorrectos.",
          );
        }

        setEnviando(false);
        return;
      }

      window.location.href =
        respuesta?.url || "/acceso";
    } catch (error) {
      console.error(
        "Error al iniciar sesión:",
        error,
      );

      setTipoMensaje("error");

      setMensaje(
        "No fue posible iniciar sesión. Intenta nuevamente.",
      );

      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <section className="w-full max-w-md rounded-3xl border border-amber-300/20 bg-white/[0.04] p-8 shadow-2xl shadow-black/40">
        <div className="mb-6 flex justify-center">
          <LogoCerteza
            variant="gold"
            width={230}
            priority
            className="max-h-40"
          />
        </div>

        <p className="text-center text-xs font-black uppercase tracking-[0.3em] text-amber-300">
          Plataforma autorizada
        </p>

        <h1 className="mt-3 text-center text-3xl font-black">
          Acceso al sistema
        </h1>

        <p className="mt-2 text-center text-sm text-slate-400">
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
                setEmail(
                  event.target.value,
                )
              }
              required
              autoComplete="email"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-300"
            />
          </label>

          <div>
            <span className="mb-2 block text-sm font-bold text-slate-300">
              Contraseña
            </span>

            <div className="relative">
              <input
                type={
                  mostrarPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                required
                minLength={8}
                autoComplete="current-password"
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 pr-24 outline-none focus:border-cyan-300"
              />

              <button
                type="button"
                onClick={() =>
                  setMostrarPassword(
                    (valor) => !valor,
                  )
                }
                aria-label={
                  mostrarPassword
                    ? "Ocultar contraseña"
                    : "Mostrar contraseña"
                }
                aria-pressed={
                  mostrarPassword
                }
                className="absolute inset-y-0 right-3 my-auto h-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black text-slate-300 transition hover:border-cyan-300 hover:text-cyan-300"
              >
                {mostrarPassword
                  ? "Ocultar"
                  : "Mostrar"}
              </button>
            </div>
          </div>

          {mensaje && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                tipoMensaje ===
                "bloqueo"
                  ? "border-amber-300/20 bg-amber-300/10 text-amber-200"
                  : "border-rose-400/20 bg-rose-400/10 text-rose-200"
              }`}
            >
              {tipoMensaje ===
                "bloqueo" && (
                <p className="mb-1 font-black">
                  Acceso temporalmente bloqueado
                </p>
              )}

              <p>{mensaje}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-full bg-cyan-400 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando
              ? "Verificando..."
              : "Iniciar sesión"}
          </button>
        </form>
      </section>
    </main>
  );
}