import type { Metadata } from "next";
import Link from "next/link";
import LogoCertezaTecnica from "@/components/branding/LogoCertezaTecnica";
import ProjectManagerLoginForm from "./ProjectManagerLoginForm";

export const metadata: Metadata = {
  title: "Acceso | Certeza Project Manager",
  description: "Acceso autorizado a Certeza Project Manager.",
};

export default async function ProjectManagerLoginPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const q=await searchParams;
  return (
    <main style={{ minHeight:"100vh", background:"linear-gradient(145deg,#032b58 0%,#06172c 58%,#0b4f87 100%)", color:"#fff", display:"grid", placeItems:"center", padding:24 }}>
      <section style={{ width:"100%", maxWidth:500, border:"1px solid rgba(255,133,0,.38)", borderRadius:24, background:"rgba(7,29,56,.96)", padding:30, boxShadow:"0 24px 60px rgba(0,0,0,.30)" }}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:18}}>
          <LogoCertezaTecnica href="/certeza-tecnica" height={82}/>
        </div>
        <Link href="/project-manager" style={{ color:"#d9ecfb", textDecoration:"none", fontWeight:850 }}>← Volver a Project Manager</Link>
        <p style={{ margin:"24px 0 0", color:"#ff9a2f", fontSize:12, fontWeight:950, letterSpacing:".10em" }}>CERTEZA PROJECT MANAGER</p>
        <h1 style={{ margin:"7px 0 6px", fontSize:34 }}>Acceso al sistema</h1>
        <p style={{ margin:0, color:"#e5f3ff", lineHeight:1.55, fontWeight:650 }}>
          Ingresa con tu usuario y contraseña autorizados.
        </p>
        {q.error==="sin_acceso" && <div style={{marginTop:16,border:"1px solid rgba(255,150,150,.35)",background:"rgba(180,35,24,.18)",color:"#ffd6d2",borderRadius:12,padding:12,fontWeight:800}}>
          Esta cuenta no tiene permiso para acceder al Centro de Control de Project Manager.
        </div>}
        <ProjectManagerLoginForm />
      </section>
    </main>
  );
}
