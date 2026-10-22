import Link from "next/link";

export function PmHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <header style={{background:"linear-gradient(100deg,#032b58,#053f79 55%,#0b73ba)",color:"#fff",padding:"16px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",borderBottom:"4px solid #ff8500"}}>
        <Link href="/project-manager/panel" style={{color:"#fff",textDecoration:"none",fontWeight:900}}>← Centro de Control</Link>
        <div style={{fontWeight:950,fontSize:20}}>CERTEZA <span style={{color:"#ff8500"}}>PROJECT MANAGER</span></div>
      </header>
      <section style={{background:"#eef6fb",borderBottom:"1px solid #d8e6f2",padding:"22px clamp(18px,3vw,34px)"}}>
        <p style={{margin:0,color:"#ff8500",fontSize:12,fontWeight:950,letterSpacing:".08em"}}>CONTROL DE PROYECTOS</p>
        <h1 style={{margin:"6px 0 4px",fontSize:"clamp(30px,4vw,46px)",color:"#082f64"}}>{title}</h1>
        {subtitle && <p style={{margin:0,color:"#69809b",lineHeight:1.5}}>{subtitle}</p>}
      </section>
    </>
  );
}

export const card = { background:"#fff", color:"#082f64", border:"1px solid #d8e6f2", borderRadius:14, padding:18, boxShadow:"0 4px 14px rgba(2,55,108,.07)" } as const;
export const tableWrap = { overflowX:"auto", color:"#082f64", border:"1px solid #d8e6f2", borderRadius:14, background:"#fff", boxShadow:"0 4px 14px rgba(2,55,108,.07)" } as const;
