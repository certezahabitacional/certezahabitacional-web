"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

type RespuestaSignIn = {
  error?: string | null;
  code?: string | null;
  ok?: boolean;
  status?: number;
  url?: string | null;
};

export default function LoginCertezaTecnicaForm() {
  const searchParams = useSearchParams();
  const callbackParam = searchParams.get("callbackUrl") || "/panel/certeza-tecnica/generadores";
  const callbackUrl = callbackParam.startsWith("/panel/certeza-tecnica/")
    ? callbackParam
    : "/panel/certeza-tecnica/generadores";

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
        redirectTo: callbackUrl,
      })) as RespuestaSignIn | undefined;

      if (respuesta?.error) {
        if (respuesta.code === "cuenta_bloqueada") {
          setTipoMensaje("bloqueo");
          setMensaje("Cuenta temporalmente bloqueada por seguridad. El bloqueo dura 15 minutos desde el quinto intento fallido.");
        } else {
          setTipoMensaje("error");
          setMensaje("Correo o contraseña incorrectos.");
        }
        setEnviando(false);
        return;
      }

      window.location.assign(callbackUrl);
    } catch (error) {
      console.error("Error al iniciar sesión en Certeza Técnica:", error);
      setTipoMensaje("error");
      setMensaje("No fue posible iniciar sesión. Intenta nuevamente.");
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#06172b] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-6xl items-center justify-center">
        <section className="w-full max-w-md rounded-3xl border border-[#edcb71]/30 bg-[#0a2440] p-8 shadow-2xl shadow-black/40">
          <div className="mb-6 flex justify-center">
            <Image
              src="/branding/logo-certeza-tecnica.png"
              alt="Certeza Técnica"
              width={260}
              height={210}
              priority
              style={{ width: "210px", height: "auto" }}
            />
          </div>

          <p className="text-center text-xs font-black uppercase tracking-[0.22em] text-[#edcb71]">
            Certeza Técnica · Plataforma autorizada
          </p>

          <h1 className="mt-3 text-center text-3xl font-black">
            Acceso a Certeza Cost
          </h1>

          <p className="mt-2 text-center text-sm text-slate-300">
            Ingresa con tu cuenta autorizada para continuar.
          </p>

          <form onSubmit={iniciarSesion} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-200">Correo</span>
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
                className="w-full rounded-2xl border border-white/10 bg-[#04101e] px-4 py-3 text-base outline-none transition focus:border-[#edcb71] disabled:opacity-70"
              />
            </label>

            <div>
              <span className="mb-2 block text-sm font-bold text-slate-200">Contraseña</span>
              <div className="relative">
                <input
                  name="password"
                  type={mostrarPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="current-password"
                  disabled={enviando}
                  className="w-full rounded-2xl border border-white/10 bg-[#04101e] px-4 py-3 pr-24 text-base outline-none transition focus:border-[#edcb71] disabled:opacity-70"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword((valor) => !valor)}
                  disabled={enviando}
                  className="absolute inset-y-0 right-3 my-auto h-fit rounded-full border border-[#edcb71]/35 bg-[#edcb71]/5 px-3 py-1.5 text-xs font-black text-[#edcb71]"
                >
                  {mostrarPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>

            {mensaje && (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${
                tipoMensaje === "bloqueo"
                  ? "border-amber-300/20 bg-amber-300/10 text-amber-200"
                  : "border-rose-400/20 bg-rose-400/10 text-rose-200"
              }`}>
                {tipoMensaje === "bloqueo" && <p className="mb-1 font-black">Acceso temporalmente bloqueado</p>}
                <p>{mensaje}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-xl bg-[#edcb71] px-5 py-3 font-black text-[#06172b] transition hover:bg-[#f6d989] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando ? "Verificando..." : "Entrar a Certeza Cost"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/certeza-tecnica/presupuestos-costos" className="text-sm font-bold text-slate-300 hover:text-white">
              ← Regresar a Costos y Presupuestos
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
