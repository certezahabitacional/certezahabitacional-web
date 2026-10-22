import Link from "next/link";
import LogoCertezaTecnica from "@/components/branding/LogoCertezaTecnica";

export function PmHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <header style={{
        background:"linear-gradient(100deg,#032b58,#053f79 55%,#0b73ba)",
        color:"#fff",
        padding:"12px 22px",
        display:"flex",
        justifyContent:"space-between",
        alignItems:"center",
        gap:18,
        flexWrap:"wrap",
        borderBottom:"5px solid #ff8500",
        boxShadow:"0 8px 20px rgba(3,43,88,.18)"
      }}>
        <div style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}>
          <LogoCertezaTecnica href="/certeza-tecnica" height={64}/>
          <div style={{borderLeft:"1px solid rgba(255,255,255,.28)",paddingLeft:16}}>
            <div style={{fontSize:12,fontWeight:950,letterSpacing:".10em",color:"#ffb15a"}}>CERTEZA PROJECT MANAGER</div>
            <div style={{fontSize:16,fontWeight:850,color:"#ffffff",marginTop:3}}>Dirección y control de proyectos</div>
          </div>
        </div>
        <Link href="/project-manager/panel" style={{
          color:"#fff",
          textDecoration:"none",
          fontWeight:900,
          background:"rgba(255,255,255,.10)",
          border:"1px solid rgba(255,255,255,.18)",
          padding:"10px 14px",
          borderRadius:10
        }}>← Centro de Control</Link>
      </header>

      <section style={{
        background:"#eef6fb",
        borderBottom:"1px solid #d8e6f2",
        padding:"22px clamp(18px,3vw,34px)"
      }}>
        <p style={{margin:0,color:"#e87500",fontSize:12,fontWeight:950,letterSpacing:".09em"}}>CONTROL DE PROYECTOS</p>
        <h1 style={{margin:"6px 0 4px",fontSize:"clamp(30px,4vw,46px)",color:"#082f64",fontWeight:950}}>{title}</h1>
        {subtitle && <p style={{margin:0,color:"#294f73",lineHeight:1.55,fontWeight:650}}>{subtitle}</p>}
      </section>
    </>
  );
}

export const card = {
  background:"#fff",
  color:"#082f64",
  border:"1px solid #cfdfea",
  borderRadius:14,
  padding:18,
  boxShadow:"0 4px 14px rgba(2,55,108,.08)"
} as const;

export const tableWrap = {
  overflowX:"auto",
  color:"#082f64",
  border:"1px solid #cfdfea",
  borderRadius:14,
  background:"#fff",
  boxShadow:"0 4px 14px rgba(2,55,108,.08)"
} as const;
