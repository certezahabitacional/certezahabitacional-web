import type { Metadata } from "next";
import Link from "next/link";
import ProjectManagerLoginForm from "./ProjectManagerLoginForm";

export const metadata: Metadata = {
  title: "Acceso | Certeza Project Manager",
  description: "Acceso autorizado a Certeza Project Manager.",
};

export default async function ProjectManagerLoginPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const q=await searchParams;
  return (
    <main style={{ minHeight: "100vh", background: "#06172c", color: "#fff", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 460, border: "1px solid rgba(255,133,0,.36)", borderRadius: 24, background: "#0a223d", padding: 30, boxShadow: "0 24px 60px rgba(0,0,0,.28)" }}>
        <Link href="/project-manager" style={{ color: "#e5f3ff", textDecoration: "none", fontWeight: 800 }}>← Volver</Link>
        <p style={{ margin: "24px 0 0", color: "#ff9a2f", fontSize: 12, fontWeight: 950, letterSpacing: ".10em" }}>CERTEZA TÉCNICA</p>
        <h1 style={{ margin: "7px 0 6px", fontSize: 34 }}>Project Manager</h1>
        <p style={{ margin: 0, color: "#d9ecfb", lineHeight: 1.55, fontWeight: 600 }}>
          Ingresa con tu usuario y contraseña autorizados para Certeza Project Manager.
        </p>
        {q.error==="sin_acceso" && <div style={{marginTop:16,border:"1px solid rgba(255,150,150,.35)",background:"rgba(180,35,24,.18)",color:"#ffd6d2",borderRadius:12,padding:12,fontWeight:800}}>
          Esta cuenta no tiene permiso para acceder al Centro de Control de Project Manager.
        </div>}
        <ProjectManagerLoginForm />
      </section>
    </main>
  );
}
