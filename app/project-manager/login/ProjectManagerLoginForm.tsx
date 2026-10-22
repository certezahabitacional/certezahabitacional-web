"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

type RespuestaSignIn = {
  error?: string | null;
  code?: string | null;
};

export default function ProjectManagerLoginForm() {
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mostrar, setMostrar] = useState(false);

  async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;

    const datos = new FormData(event.currentTarget);
    const email = String(datos.get("email") ?? "").trim();
    const password = String(datos.get("password") ?? "");

    if (!email || !password) {
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
        redirectTo: "/project-manager/panel",
      })) as RespuestaSignIn | undefined;

      if (respuesta?.error) {
        setMensaje(
          respuesta.code === "cuenta_bloqueada"
            ? "Cuenta temporalmente bloqueada por seguridad."
            : "Correo o contraseña incorrectos.",
        );
        setEnviando(false);
        return;
      }

      window.location.assign("/project-manager/panel");
    } catch {
      setMensaje("No fue posible iniciar sesión. Intenta nuevamente.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={iniciarSesion} style={{ marginTop: 24, display: "grid", gap: 16 }}>
      <label style={{ display: "grid", gap: 7 }}>
        <span style={{ fontWeight: 800, color: "#d5e0ec" }}>Correo</span>
        <input name="email" type="email" required autoComplete="email" disabled={enviando} style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "#06172c", color: "#fff", padding: "13px 14px", fontSize: 16 }} />
      </label>

      <label style={{ display: "grid", gap: 7 }}>
        <span style={{ fontWeight: 800, color: "#d5e0ec" }}>Contraseña</span>
        <div style={{ display: "flex", gap: 8 }}>
          <input name="password" type={mostrar ? "text" : "password"} required minLength={8} autoComplete="current-password" disabled={enviando} style={{ flex: 1, minWidth: 0, borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "#06172c", color: "#fff", padding: "13px 14px", fontSize: 16 }} />
          <button type="button" onClick={() => setMostrar((valor) => !valor)} style={{ borderRadius: 12, border: "1px solid rgba(237,203,113,.32)", background: "transparent", color: "#edcb71", padding: "0 12px", fontWeight: 800 }}>{mostrar ? "Ocultar" : "Mostrar"}</button>
        </div>
      </label>

      {mensaje && <p style={{ margin: 0, borderRadius: 12, border: "1px solid rgba(244,114,182,.22)", background: "rgba(244,63,94,.09)", color: "#fecdd3", padding: 12 }}>{mensaje}</p>}

      <button type="submit" disabled={enviando} style={{ minHeight: 48, border: 0, borderRadius: 12, background: "#edcb71", color: "#071d38", fontWeight: 900, fontSize: 16, cursor: "pointer", opacity: enviando ? .65 : 1 }}>
        {enviando ? "Verificando..." : "Entrar a Project Manager"}
      </button>
    </form>
  );
}
