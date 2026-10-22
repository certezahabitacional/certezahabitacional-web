import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LogoCertezaTecnica from "@/components/branding/LogoCertezaTecnica";
import { cambiarMiPasswordProjectManager } from "./actions";

export default async function CambiarPasswordPage({searchParams}:{searchParams:Promise<{ok?:string;error?:string}>}) {
  const session=await auth();
  if(!session?.user) redirect("/project-manager/login");
  const q=await searchParams;
  const input={border:"1px solid #b7cadb",borderRadius:10,padding:"12px 13px",fontSize:15,color:"#082f64",background:"#fff",width:"100%",boxSizing:"border-box" as const};

  return <main style={{minHeight:"100vh",background:"linear-gradient(145deg,#eef6fb 0%,#dcecf7 100%)",display:"grid",placeItems:"center",padding:22,color:"#082f64"}}>
    <section style={{width:"min(560px,100%)",background:"#fff",border:"1px solid #cfdfea",borderRadius:18,padding:28,boxShadow:"0 12px 36px rgba(2,55,108,.14)"}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:18}}>
        <LogoCertezaTecnica href="/certeza-tecnica" height={82}/>
      </div>
      <div style={{fontSize:13,color:"#e87500",fontWeight:950,letterSpacing:".08em"}}>CERTEZA PROJECT MANAGER</div>
      <h1 style={{margin:"7px 0 6px"}}>Cambiar contraseña</h1>
      <p style={{color:"#294f73",fontWeight:650,lineHeight:1.55}}>La nueva contraseña debe tener al menos 8 caracteres.</p>
      {q.ok&&<div style={{background:"#dcfae6",color:"#137a42",padding:12,borderRadius:10,fontWeight:800}}>Contraseña actualizada correctamente.</div>}
      {q.error&&<div style={{background:"#fee4e2",color:"#b42318",padding:12,borderRadius:10,fontWeight:800}}>{q.error==="actual"?"La contraseña actual no coincide.":"Revisa la nueva contraseña y su confirmación."}</div>}
      <form action={cambiarMiPasswordProjectManager} style={{display:"grid",gap:14,marginTop:18}}>
        <label style={{display:"grid",gap:6,fontWeight:800}}>Contraseña actual<input name="actual" type="password" required autoComplete="current-password" style={input}/></label>
        <label style={{display:"grid",gap:6,fontWeight:800}}>Nueva contraseña<input name="nueva" type="password" required minLength={8} autoComplete="new-password" style={input}/></label>
        <label style={{display:"grid",gap:6,fontWeight:800}}>Confirmar nueva contraseña<input name="confirmar" type="password" required minLength={8} autoComplete="new-password" style={input}/></label>
        <button type="submit" style={{border:0,borderRadius:10,padding:"13px 16px",background:"#ff8500",color:"#fff",fontWeight:950,cursor:"pointer"}}>Guardar nueva contraseña</button>
      </form>
      <Link href="/project-manager/panel" style={{display:"inline-block",marginTop:18,color:"#0a6fdc",fontWeight:900,textDecoration:"none"}}>← Volver al Centro de Control</Link>
    </section>
  </main>
}
