import type { Metadata } from "next";
import Link from "next/link";
import ProjectManagerLoginForm from "./ProjectManagerLoginForm";

export const metadata: Metadata = {
  title: "Acceso | Certeza Project Manager",
  description: "Acceso autorizado a Certeza Project Manager.",
};

export default function ProjectManagerLoginPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#06172c", color: "#fff", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 460, border: "1px solid rgba(237,203,113,.30)", borderRadius: 24, background: "#0a223d", padding: 30, boxShadow: "0 24px 60px rgba(0,0,0,.28)" }}>
        <Link href="/project-manager" style={{ color: "#c8d4df", textDecoration: "none", fontWeight: 700 }}>← Volver</Link>
        <p style={{ margin: "24px 0 0", color: "#edcb71", fontSize: 12, fontWeight: 900, letterSpacing: ".10em" }}>CERTEZA TÉCNICA</p>
        <h1 style={{ margin: "7px 0 6px", fontSize: 34 }}>Project Manager</h1>
        <p style={{ margin: 0, color: "#9fb2c6", lineHeight: 1.5 }}>Ingresa con tu cuenta autorizada. El acceso operativo queda separado del panel de Certeza Habitacional.</p>
        <ProjectManagerLoginForm />
      </section>
    </main>
  );
}
